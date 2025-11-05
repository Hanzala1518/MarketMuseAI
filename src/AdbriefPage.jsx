import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function AdbriefPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = location.state?.campaignId;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [numVariations, setNumVariations] = useState('3');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setSession(session);
      }
    };
    getSession();
  }, [navigate]);

  const handleGenerate = async () => {
    if (!productName.trim() || !productDescription.trim() || !targetAudience.trim()) {
      alert('Please fill in product name, description, and target audience');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const requestData = {
        product_name: productName.trim(),
        product_description: productDescription.trim(),
        target_audience: targetAudience.trim(),
        offer: offer.trim() || 'Limited Time Offer',
        num_variations: parseInt(numVariations)
      };

      const outputSummary = `${numVariations} ad brief variations for ${productName}`;

      const tokenResult = await executeWithTokens(
        session.user.id,
        'Adbrief',
        async () => {
          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/adbrief', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([requestData])
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Adbrief API Error:', errorText);
            
            // Check for specific n8n workflow error
            if (errorText.includes('Unused Respond to Webhook node')) {
              throw new Error('Adbrief workflow is not properly configured. Please contact support or check the n8n workflow setup.');
            }
            
            throw new Error(`Adbrief API error: ${response.status} - ${errorText}`);
          }

          const responseText = await response.text();
          if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from Adbrief webhook');
          }

          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            throw new Error('Invalid JSON response from Adbrief webhook');
          }

          return data;
        },
        requestData,
        1, // Token multiplier (Adbrief uses 1x the base cost of 75 tokens)
        outputSummary,
        campaignId
      );

      if (tokenResult.success) {
        setResult(tokenResult.data);

        // Handle campaign integration
        if (campaignId && tokenResult.logId) {
          try {
            const { data: agentData, error: agentError } = await supabase
              .from('agents')
              .select('id')
              .eq('name', 'Adbrief')
              .single();

            if (agentError) {
              console.error('Error fetching Adbrief agent ID:', agentError);
            } else if (agentData) {
              await handleCampaignTaskCompletion(
                campaignId,
                agentData.id,
                'Adbrief',
                tokenResult.logId,
                tokenResult.data,
                outputSummary
              );

              alert('Ad briefs saved to campaign! You can run this agent again to create additional variations.');
            }
          } catch (campaignError) {
            console.error('Campaign completion error:', campaignError);
          }
        }
      } else {
        alert(tokenResult.message || 'Failed to generate ad briefs');
      }
    } catch (error) {
      console.error('Adbrief Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderBriefs = () => {
    if (!result || !Array.isArray(result) || result.length === 0) return null;

    const outputData = result[0]?.output;
    if (!outputData || !outputData.generated_briefs) return null;

    return (
      <div style={styles.resultsContainer}>
        <div style={styles.resultsHeader}>
          <div>
            <h2 style={styles.resultsTitle}>✨ Ad Brief Variations</h2>
            <p style={styles.resultsSubtitle}>
              {outputData.product_name} • {outputData.target_audience}
            </p>
          </div>
          <button style={styles.newAnalysisButton} onClick={() => setResult(null)}>
            🎨 Create New Brief
          </button>
        </div>

        <div style={styles.briefsGrid}>
          {outputData.generated_briefs.map((brief, index) => (
            <div key={index} style={styles.briefCard}>
              <div style={styles.briefHeader}>
                <span style={styles.briefNumber}>Variation {index + 1}</span>
                <span style={styles.briefAngle}>{brief.variation_name}</span>
              </div>

              <div style={styles.briefContent}>
                <div style={styles.briefSection}>
                  <div style={styles.sectionLabel}>Headline</div>
                  <h3 style={styles.headline}>{brief.headline}</h3>
                </div>

                <div style={styles.briefSection}>
                  <div style={styles.sectionLabel}>Sub-Heading</div>
                  <p style={styles.subHeading}>{brief.sub_heading}</p>
                </div>

                <div style={styles.briefSection}>
                  <div style={styles.sectionLabel}>Key Pointers</div>
                  <div style={styles.keyPointers}>
                    {brief.key_pointers.split('\n').map((point, i) => (
                      point.trim() && (
                        <div key={i} style={styles.pointer}>
                          {point.trim().startsWith('-') ? point.trim().substring(1).trim() : point.trim()}
                        </div>
                      )
                    ))}
                  </div>
                </div>

                <div style={styles.ctaSection}>
                  <div style={styles.briefSection}>
                    <div style={styles.sectionLabel}>Call to Action</div>
                    <p style={styles.ctaText}>{brief.call_to_action}</p>
                  </div>
                  <button style={styles.buttonPreview}>
                    {brief.button_text}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <style>{keyframes}</style>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>✨ Adbrief</h1>
          <p style={styles.subtitle}>Generate creative ad briefs with multiple strategic angles</p>
          <button style={styles.backButton} onClick={() => navigate(campaignId ? `/campaigns/${campaignId}` : '/')}>
            ← Back to {campaignId ? 'Campaign' : 'Dashboard'}
          </button>
        </div>

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingAnimation}>
              <div style={styles.sparkle1}>✨</div>
              <div style={styles.lightbulb}>💡</div>
              <div style={styles.sparkle2}>✨</div>
              <div style={styles.rocket}>🚀</div>
            </div>
            <p style={styles.loadingText}>Crafting creative ad briefs...</p>
            <p style={styles.loadingSubtext}>Exploring multiple angles and strategies</p>
          </div>
        )}

        {!loading && !result && (
          <div style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Product Name *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., IntelliBin Smart Dustbin"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Product Description *</label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product's features and benefits..."
                rows="4"
                style={styles.textarea}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Target Audience *</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Tech-savvy homeowners and families"
                style={styles.input}
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Offer</label>
                <input
                  type="text"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="e.g., 20% OFF Launch Sale"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Number of Variations (1-5)</label>
                <input
                  type="number"
                  value={numVariations}
                  onChange={(e) => setNumVariations(Math.min(5, Math.max(1, e.target.value)))}
                  min="1"
                  max="5"
                  style={styles.input}
                />
              </div>
            </div>

            <button
              style={styles.generateButton}
              onClick={handleGenerate}
            >
              ✨ Generate Ad Briefs
            </button>

            <div style={styles.tokenInfo}>
              💎 Cost: 75 tokens per generation
            </div>
          </div>
        )}

        {!loading && result && renderBriefs()}
      </div>
    </div>
  );
}

const keyframes = `
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes sparkle {
    0%, 100% {
      opacity: 0.3;
      transform: scale(0.8) rotate(0deg);
    }
    50% {
      opacity: 1;
      transform: scale(1.2) rotate(180deg);
    }
  }

  @keyframes glow {
    0%, 100% {
      opacity: 0.6;
      transform: scale(1);
      filter: brightness(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
      filter: brightness(1.5);
    }
  }

  @keyframes launch {
    0%, 100% {
      transform: translateY(0) rotate(-45deg);
    }
    50% {
      transform: translateY(-15px) rotate(-45deg);
    }
  }
`;

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '2rem 1rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '3rem',
    color: 'white',
    animation: 'fadeInDown 0.6s ease-out',
  },
  title: {
    fontSize: '3.5rem',
    margin: '0 0 1rem 0',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-1px',
  },
  subtitle: {
    fontSize: '1.25rem',
    opacity: 0.9,
    marginBottom: '1.5rem',
    color: '#cbd5e1',
    fontWeight: '400',
  },
  backButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '0.75rem 1.5rem',
    borderRadius: '12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
  },
  loadingContainer: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '4rem 3rem',
    textAlign: 'center',
    animation: 'fadeInUp 0.6s ease-out',
  },
  loadingAnimation: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '2rem',
    marginBottom: '2rem',
    fontSize: '4rem',
  },
  sparkle1: {
    animation: 'sparkle 2s ease-in-out infinite',
    color: '#f59e0b',
  },
  lightbulb: {
    animation: 'glow 2s ease-in-out infinite',
    fontSize: '5rem',
  },
  sparkle2: {
    animation: 'sparkle 2s ease-in-out infinite 0.5s',
    color: '#ec4899',
  },
  rocket: {
    animation: 'launch 2s ease-in-out infinite',
  },
  loadingText: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '0.5rem',
  },
  loadingSubtext: {
    fontSize: '1rem',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  form: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '3rem',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    animation: 'fadeInUp 0.6s ease-out 0.1s both',
  },
  formGroup: {
    marginBottom: '2rem',
  },
  label: {
    display: 'block',
    fontWeight: '600',
    marginBottom: '0.75rem',
    color: '#e2e8f0',
    fontSize: '1rem',
  },
  input: {
    width: '100%',
    padding: '1rem 1.25rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '1rem',
    color: 'white',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '1rem 1.25rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '1rem',
    color: 'white',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '120px',
    lineHeight: '1.6',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
  },
  generateButton: {
    width: '100%',
    padding: '1.25rem 2rem',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontSize: '1.125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
    marginTop: '1.5rem',
  },
  tokenInfo: {
    textAlign: 'center',
    marginTop: '1.5rem',
    color: '#94a3b8',
    fontSize: '1rem',
    fontWeight: '500',
    padding: '1rem',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  resultsContainer: {
    animation: 'fadeInUp 0.6s ease-out 0.2s both',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
    gap: '1.5rem',
  },
  resultsTitle: {
    fontSize: '2.5rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 0.5rem 0',
  },
  resultsSubtitle: {
    fontSize: '1.125rem',
    color: '#94a3b8',
    margin: 0,
    fontWeight: '500',
  },
  newAnalysisButton: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    padding: '0.875rem 1.75rem',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
  },
  briefsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '2rem',
  },
  briefCard: {
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '20px',
    padding: '2rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.4s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  briefHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    paddingBottom: '1.25rem',
    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  briefNumber: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '0.875rem',
  },
  briefAngle: {
    color: '#a78bfa',
    fontWeight: '600',
    fontSize: '0.95rem',
    fontStyle: 'italic',
  },
  briefContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  briefSection: {
    marginBottom: '0.5rem',
  },
  sectionLabel: {
    display: 'block',
    color: '#f59e0b',
    marginBottom: '0.75rem',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '700',
  },
  headline: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#e2e8f0',
    lineHeight: '1.4',
  },
  subHeading: {
    margin: 0,
    fontSize: '1.125rem',
    color: '#cbd5e1',
    lineHeight: '1.6',
    fontWeight: '500',
  },
  keyPointers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  pointer: {
    padding: '0.875rem 1.125rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    color: '#cbd5e1',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    borderLeft: '3px solid #ec4899',
    transition: 'all 0.3s ease',
  },
  ctaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  ctaText: {
    margin: 0,
    fontSize: '1rem',
    color: '#e2e8f0',
    lineHeight: '1.6',
    fontWeight: '500',
  },
  buttonPreview: {
    padding: '0.875rem 2rem',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
    alignSelf: 'flex-start',
  },
};

export default AdbriefPage;
