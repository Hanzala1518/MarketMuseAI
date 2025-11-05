import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';

function AdbriefPopup({ isOpen, onClose, onSelectBrief, userId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [numVariations, setNumVariations] = useState('3');

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
        userId,
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
        null // No campaignId for popup
      );

      if (tokenResult.success) {
        setResult(tokenResult.data);
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

  const handleUseBrief = (brief) => {
    // Pass the selected brief data to AdVisor
    onSelectBrief({
      headline: brief.headline,
      subHeading: brief.sub_heading,
      primaryText: brief.key_pointers.split('\n').filter(p => p.trim()).map(p => 
        p.trim().startsWith('-') ? p.trim().substring(1).trim() : p.trim()
      ).join('\n\n'),
      callToAction: brief.call_to_action,
      buttonText: brief.button_text
    });
    
    // Close popup after selection
    handleClose();
  };

  const handleRegenerate = () => {
    setResult(null);
  };

  const handleClose = () => {
    setResult(null);
    setProductName('');
    setProductDescription('');
    setTargetAudience('');
    setOffer('');
    setNumVariations('3');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <style>{keyframes}</style>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={styles.popupHeader}>
          <div>
            <h2 style={styles.popupTitle}>✨ Create Ad Brief</h2>
            <p style={styles.popupSubtitle}>Generate creative briefs to auto-fill your ad</p>
          </div>
          <button style={styles.closeButton} onClick={handleClose}>✕</button>
        </div>

        <div style={styles.popupContent}>
          {loading && (
            <div style={styles.loadingContainer}>
              <div style={styles.loadingAnimation}>
                <div style={styles.sparkle1}>✨</div>
                <div style={styles.lightbulb}>💡</div>
                <div style={styles.sparkle2}>✨</div>
                <div style={styles.rocket}>🚀</div>
              </div>
              <p style={styles.loadingText}>Crafting creative ad briefs...</p>
              <p style={styles.loadingSubtext}>Exploring multiple angles</p>
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
                  placeholder="Describe your product's features..."
                  rows="3"
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Target Audience *</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Tech-savvy homeowners"
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
                    placeholder="e.g., 20% OFF"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Variations (1-5)</label>
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

              <button style={styles.generateButton} onClick={handleGenerate}>
                ✨ Generate Briefs
              </button>

              <div style={styles.tokenInfo}>
                💎 Cost: 75 tokens
              </div>
            </div>
          )}

          {!loading && result && (
            <div style={styles.resultsContainer}>
              <div style={styles.resultsHeader}>
                <p style={styles.resultsTitle}>Select a brief to auto-fill</p>
                <button style={styles.regenerateButton} onClick={handleRegenerate}>
                  🔄 Regenerate
                </button>
              </div>

              <div style={styles.briefsList}>
                {result[0]?.output?.generated_briefs?.map((brief, index) => (
                  <div key={index} style={styles.briefCard}>
                    <div style={styles.briefHeader}>
                      <span style={styles.briefNumber}>Variation {index + 1}</span>
                      <span style={styles.briefAngle}>{brief.variation_name}</span>
                    </div>

                    <div style={styles.briefContent}>
                      <div style={styles.briefSection}>
                        <div style={styles.sectionLabel}>Headline</div>
                        <h4 style={styles.headline}>{brief.headline}</h4>
                      </div>

                      <div style={styles.briefSection}>
                        <div style={styles.sectionLabel}>Sub-Heading</div>
                        <p style={styles.subHeading}>{brief.sub_heading}</p>
                      </div>

                      <div style={styles.briefSection}>
                        <div style={styles.sectionLabel}>Key Points</div>
                        <div style={styles.keyPointers}>
                          {brief.key_pointers.split('\n').slice(0, 3).map((point, i) => (
                            point.trim() && (
                              <div key={i} style={styles.pointer}>
                                {point.trim().startsWith('-') ? point.trim().substring(1).trim() : point.trim()}
                              </div>
                            )
                          ))}
                        </div>
                      </div>

                      <div style={styles.ctaPreview}>
                        <span style={styles.ctaLabel}>CTA:</span>
                        <span style={styles.ctaText}>{brief.call_to_action}</span>
                      </div>
                    </div>

                    <button
                      style={styles.useButton}
                      onClick={() => handleUseBrief(brief)}
                    >
                      ✓ Use This Brief
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const keyframes = `
  @keyframes popupAppear {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
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
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '2rem',
    animation: 'popupAppear 0.3s ease-out',
  },
  popup: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '24px',
    maxWidth: '1000px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 100px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '2rem 2.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.03)',
  },
  popupTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '2rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  popupSubtitle: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '0.95rem',
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    fontSize: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '300',
  },
  popupContent: {
    padding: '2rem 2.5rem',
    overflowY: 'auto',
    flex: 1,
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '3rem 2rem',
  },
  loadingAnimation: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '1.5rem',
    fontSize: '3rem',
  },
  sparkle1: {
    animation: 'sparkle 2s ease-in-out infinite',
    color: '#f59e0b',
  },
  lightbulb: {
    animation: 'glow 2s ease-in-out infinite',
    fontSize: '4rem',
  },
  sparkle2: {
    animation: 'sparkle 2s ease-in-out infinite 0.5s',
    color: '#ec4899',
  },
  rocket: {
    animation: 'launch 2s ease-in-out infinite',
  },
  loadingText: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '0.5rem',
  },
  loadingSubtext: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  formGroup: {
    marginBottom: 0,
  },
  label: {
    display: 'block',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#e2e8f0',
    fontSize: '0.95rem',
  },
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '0.95rem',
    color: 'white',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '0.95rem',
    color: 'white',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '80px',
    lineHeight: '1.5',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  generateButton: {
    width: '100%',
    padding: '1rem 1.5rem',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
    marginTop: '0.5rem',
  },
  tokenInfo: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.9rem',
    fontWeight: '500',
    padding: '0.75rem',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '10px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  resultsTitle: {
    margin: 0,
    fontSize: '1.125rem',
    color: '#e2e8f0',
    fontWeight: '600',
  },
  regenerateButton: {
    background: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    padding: '0.625rem 1.25rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  briefsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxHeight: '500px',
    overflowY: 'auto',
    paddingRight: '0.5rem',
  },
  briefCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '16px',
    padding: '1.5rem',
    transition: 'all 0.3s ease',
  },
  briefHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  briefNumber: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    padding: '0.375rem 0.875rem',
    borderRadius: '15px',
    fontWeight: '700',
    fontSize: '0.8rem',
  },
  briefAngle: {
    color: '#a78bfa',
    fontWeight: '600',
    fontSize: '0.85rem',
    fontStyle: 'italic',
  },
  briefContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  briefSection: {
    marginBottom: 0,
  },
  sectionLabel: {
    display: 'block',
    color: '#f59e0b',
    marginBottom: '0.5rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '700',
  },
  headline: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#e2e8f0',
    lineHeight: '1.4',
  },
  subHeading: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#cbd5e1',
    lineHeight: '1.5',
  },
  keyPointers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  pointer: {
    padding: '0.625rem 0.875rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '0.85rem',
    lineHeight: '1.4',
    borderLeft: '2px solid #ec4899',
  },
  ctaPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.875rem',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  ctaLabel: {
    color: '#f59e0b',
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  ctaText: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#e2e8f0',
    lineHeight: '1.5',
  },
  useButton: {
    width: '100%',
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
  },
};

export default AdbriefPopup;
