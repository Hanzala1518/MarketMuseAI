import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Users, Target, Mail, Building2, CheckCircle, AlertCircle, Loader2, Zap, UserPlus, TrendingUp, ChevronDown, ChevronUp, Globe, Phone, Briefcase, MapPin, Star, Award, ExternalLink, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function LeadGenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId might be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [industry, setIndustry] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  // Session management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!industry || !locationInput) {
      setError('Please enter both industry and location');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use LeadGen');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting LeadGen for:', industry, locationInput);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('🚀 Starting LeadGen with token deduction...');
      
      // Execute with token deduction (150 tokens)
      const tokenResult = await executeWithTokens(
        session.user.id,
        'LeadGen',
        async () => {
          // Make API call
          console.log('Sending request with:', { industry, location: locationInput });
          
          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ industry: industry, location: locationInput }])
          });

          console.log('Response status:', response.status);

          if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }

          // Check if response has content
          const contentType = response.headers.get('content-type');
          console.log('Content-Type:', contentType);

          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.log('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. This is likely an n8n configuration issue.');
          }

          const text = await response.text();
          console.log('Raw response:', text);

          if (!text || text.trim() === '') {
            throw new Error('Server returned empty response. The n8n workflow may not be returning data properly.');
          }

          const data = JSON.parse(text);
          console.log('Parsed data:', data);
          
          return data[0]?.output || data;
        },
        { industry, location: locationInput }, // Request data
        1, // Token multiplier (fixed cost)
        `Lead Generation: ${industry} in ${locationInput}`, // Output summary
        campaignId // Campaign ID
      );

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted
      console.log(`✅ LeadGen completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${tokenResult.tokensRemaining}`);
      
      setResult(tokenResult.data);

      // Handle campaign task completion if this is part of a campaign
      if (campaignId) {
        console.log('📁 This is part of campaign:', campaignId);
        console.log('📁 Log ID from tokenResult:', tokenResult.logId);
        
        if (!tokenResult.logId) {
          console.error('❌ No logId returned from tokenService!');
        } else {
          console.log('✅ LogId available, proceeding with campaign artifact save...');
          
          // Get agent ID from database
          const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select('id')
            .eq('name', 'LeadGen')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ LeadGen agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `Lead Generation: ${industry} in ${locationInput}`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'LeadGen',
              tokenResult.logId,
              tokenResult.data,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Lead generation completed but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }
    } catch (err) {
      console.error('❌ LeadGen error:', err);
      setError(err.message || 'Lead generation failed');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#fbbf24';
    if (score >= 30) return '#fb923c';
    return '#ef4444';
  };

  const getConversionColor = (likelihood) => {
    if (likelihood === 'High') return '#10b981';
    if (likelihood === 'Medium') return '#fbbf24';
    return '#ef4444';
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} size={16} fill="#fbbf24" color="#fbbf24" />);
    }
    
    if (hasHalfStar) {
      stars.push(
        <div key="half" style={{ position: 'relative', display: 'inline-block' }}>
          <Star size={16} color="#fbbf24" />
          <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
            <Star size={16} fill="#fbbf24" color="#fbbf24" />
          </div>
        </div>
      );
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} size={16} color="#4b5563" />);
    }
    
    return stars;
  };

  const leads = result?.scored_leads || [];
  // Sort leads by leadScore in descending order (highest first)
  const sortedLeads = [...leads].sort((a, b) => b.leadScore - a.leadScore);
  const topLeads = sortedLeads.filter(lead => lead.leadScore >= 40);
  const avgScore = sortedLeads.length > 0 ? (sortedLeads.reduce((sum, lead) => sum + lead.leadScore, 0) / sortedLeads.length).toFixed(1) : 0;
  const highConversionLeads = sortedLeads.filter(lead => lead.conversionLikelihood === 'High' || lead.conversionLikelihood === 'Medium').length;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      {!result && (
        <div style={s.hero}>
          <div style={s.heroIcon}><UserPlus size={40} /></div>
          <h1 style={s.title}>LeadGen AI</h1>
          <p style={s.subtitle}>Discover high-quality leads from Google Maps instantly</p>
        </div>
      )}

      <div style={s.main}>
        {!result && !loading && (
          <div style={s.card}>
            <div style={s.inputGroup}>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry (e.g., cyber security, restaurants)"
                style={s.input}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Location (e.g., Indore, Mumbai)"
                style={s.input}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {error && <div style={s.error}><AlertCircle size={16} /> {error}</div>}
            <button onClick={handleSubmit} style={s.btn}>
              <Search size={18} /> Generate Leads
            </button>
          </div>
        )}

        {loading && (
          <div style={s.loading}>
            <div style={s.mapAnimation}>
              <div style={s.mapCircle}>
                <MapPin size={40} style={s.mapPin} color="#8b5cf6" />
                <div style={s.ripple1}></div>
                <div style={s.ripple2}></div>
                <div style={s.ripple3}></div>
              </div>
              <div style={s.scanLine}></div>
            </div>
            <h2 style={s.loadTitle}>Scanning Google Maps...</h2>
            <p style={s.loadText}>🗺️ Discovering businesses • 📍 Extracting contacts • ⚡ Scoring leads</p>
          </div>
        )}

        {result && (
          <div style={s.results}>
            <div style={s.resultHeader}>
              <div>
                <h1 style={s.reportTitle}>Lead Generation Report</h1>
                <p style={s.reportSub}>📍 {industry} in {locationInput}</p>
              </div>
              <button onClick={() => { setResult(null); setIndustry(''); setLocationInput(''); }} style={s.newBtn}>
                <Search size={16} /> New Search
              </button>
            </div>

            {/* Summary Dashboard */}
            <div style={s.summaryGrid}>
              <div style={s.summaryCard}>
                <div style={{...s.summaryIcon, background: 'linear-gradient(135deg, #8b5cf6, #ec4899)'}}>
                  <Users size={24} />
                </div>
                <div style={s.summaryContent}>
                  <div style={s.summaryLabel}>Total Leads</div>
                  <div style={s.summaryValue}>{sortedLeads.length}</div>
                </div>
              </div>

              <div style={s.summaryCard}>
                <div style={{...s.summaryIcon, background: 'linear-gradient(135deg, #10b981, #84cc16)'}}>
                  <Target size={24} />
                </div>
                <div style={s.summaryContent}>
                  <div style={s.summaryLabel}>Quality Leads</div>
                  <div style={s.summaryValue}>{topLeads.length}</div>
                  <div style={s.summaryHint}>Score ≥ 40</div>
                </div>
              </div>

              <div style={s.summaryCard}>
                <div style={{...s.summaryIcon, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)'}}>
                  <TrendingUp size={24} />
                </div>
                <div style={s.summaryContent}>
                  <div style={s.summaryLabel}>Avg Lead Score</div>
                  <div style={s.summaryValue}>{avgScore}</div>
                  <div style={s.summaryHint}>out of 100</div>
                </div>
              </div>

              <div style={s.summaryCard}>
                <div style={{...s.summaryIcon, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)'}}>
                  <Zap size={24} />
                </div>
                <div style={s.summaryContent}>
                  <div style={s.summaryLabel}>High Potential</div>
                  <div style={s.summaryValue}>{highConversionLeads}</div>
                  <div style={s.summaryHint}>Medium-High conversion</div>
                </div>
              </div>
            </div>

            {/* Leads List */}
            <div style={s.card}>
              <h2 style={s.h2}>
                <Award size={20} /> Discovered Leads ({sortedLeads.length})
              </h2>
              
              {sortedLeads.map((lead, i) => (
                <div key={i} style={s.leadCard} className="lead-card">
                  <div style={s.leadHeader} onClick={() => toggle(`lead-${i}`)}>
                    <div style={s.leadHeaderLeft}>
                      <div style={s.leadRank}>#{i + 1}</div>
                      <div>
                        <div style={s.leadName}>{lead.companyName}</div>
                        <div style={s.leadCategory}>{lead.category}</div>
                      </div>
                    </div>
                    <div style={s.leadHeaderRight}>
                      <div style={{...s.scoreCircle, borderColor: getScoreColor(lead.leadScore)}}>
                        <div style={{...s.scoreText, color: getScoreColor(lead.leadScore)}}>{lead.leadScore.toFixed(0)}</div>
                      </div>
                      {expanded[`lead-${i}`] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Rating and Location Bar */}
                  <div style={s.leadMetaBar}>
                    <div style={s.ratingSection}>
                      <div style={s.stars}>{renderStars(lead.rating)}</div>
                      <span style={s.ratingText}>{lead.rating} ({lead.ratingCount} reviews)</span>
                    </div>
                    <div style={{...s.conversionBadge, background: `${getConversionColor(lead.conversionLikelihood)}20`, color: getConversionColor(lead.conversionLikelihood), border: `1px solid ${getConversionColor(lead.conversionLikelihood)}40`}}>
                      {lead.conversionLikelihood} Conversion
                    </div>
                  </div>

                  {expanded[`lead-${i}`] && (
                    <div style={s.leadDetails}>
                      {/* Contact Information Grid */}
                      <div style={s.contactSection}>
                        <h4 style={s.sectionTitle}>Contact Information</h4>
                        <div style={s.contactGrid}>
                          {lead.phoneNumber && lead.phoneNumber !== 'Not Available' && (
                            <div style={s.contactItem}>
                              <Phone size={18} color="#8b5cf6" />
                              <div>
                                <div style={s.contactLabel}>Phone</div>
                                <div style={s.contactValue}>{lead.phoneNumber}</div>
                              </div>
                            </div>
                          )}
                          
                          {lead.emailAddress && lead.emailAddress !== 'Not Available' && (
                            <div style={s.contactItem}>
                              <Mail size={18} color="#8b5cf6" />
                              <div>
                                <div style={s.contactLabel}>Email</div>
                                <div style={s.contactValue}>{lead.emailAddress.split(',')[0]}</div>
                              </div>
                            </div>
                          )}
                          
                          {lead.website && (
                            <div style={s.contactItem}>
                              <Globe size={18} color="#8b5cf6" />
                              <div>
                                <div style={s.contactLabel}>Website</div>
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" style={s.websiteLink}>
                                  Visit Site <ExternalLink size={12} />
                                </a>
                              </div>
                            </div>
                          )}
                          
                          {lead.exactAddress && (
                            <div style={{...s.contactItem, gridColumn: '1 / -1'}}>
                              <MapPin size={18} color="#8b5cf6" />
                              <div>
                                <div style={s.contactLabel}>Address</div>
                                <div style={s.contactValue}>{lead.exactAddress}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lead Insights */}
                      <div style={s.insightsSection}>
                        <h4 style={s.sectionTitle}>Lead Insights</h4>
                        <div style={s.insightsGrid}>
                          <div style={{...s.insightBadge, background: lead.industryMatch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${lead.industryMatch ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: lead.industryMatch ? '#10b981' : '#ef4444'}}>
                            {lead.industryMatch ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            Industry Match
                          </div>
                          <div style={{...s.insightBadge, background: lead.locationMatch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${lead.locationMatch ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: lead.locationMatch ? '#10b981' : '#ef4444'}}>
                            {lead.locationMatch ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            Location Match
                          </div>
                          <div style={{...s.insightBadge, background: lead.validContact ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${lead.validContact ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: lead.validContact ? '#10b981' : '#ef4444'}}>
                            {lead.validContact ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            Valid Contact
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div style={s.scoreBreakdown}>
                        <h4 style={s.sectionTitle}>Lead Score Breakdown</h4>
                        <div style={s.scoreBar}>
                          <div style={{...s.scoreBarFill, width: `${lead.leadScore}%`, background: `linear-gradient(90deg, ${getScoreColor(0)}, ${getScoreColor(lead.leadScore)})`}}>
                            <span style={s.scoreBarText}>{lead.leadScore.toFixed(1)}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* AI Recommendations */}
            <div style={s.card}>
              <h2 style={s.h2}><Zap size={20} /> Next Steps</h2>
              <div style={s.recommendationsGrid}>
                <div style={s.recCard}>
                  <div style={{...s.recIcon, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)'}}>
                    <Target size={20} color="#8b5cf6" />
                  </div>
                  <div style={s.recContent}>
                    <div style={s.recTitle}>Prioritize High Scorers</div>
                    <div style={s.recText}>Focus on leads with scores above 40 for best conversion rates</div>
                  </div>
                </div>

                <div style={s.recCard}>
                  <div style={{...s.recIcon, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)'}}>
                    <Phone size={20} color="#10b981" />
                  </div>
                  <div style={s.recContent}>
                    <div style={s.recTitle}>Verify Contact Info</div>
                    <div style={s.recText}>Cross-check phone and email before reaching out</div>
                  </div>
                </div>

                <div style={s.recCard}>
                  <div style={{...s.recIcon, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)'}}>
                    <Mail size={20} color="#fbbf24" />
                  </div>
                  <div style={s.recContent}>
                    <div style={s.recTitle}>Personalize Outreach</div>
                    <div style={s.recText}>Mention their rating and category in your message</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s' },
  hero: { textAlign: 'center', padding: '4rem 2rem' },
  heroIcon: { display: 'inline-flex', padding: '1.5rem', background: 'rgba(139,92,246,0.1)', borderRadius: '20px', marginBottom: '1.5rem', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6' },
  title: { fontSize: '3rem', fontWeight: '700', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' },
  subtitle: { fontSize: '1.25rem', color: '#94a3b8' },
  main: { maxWidth: '1400px', margin: '0 auto', padding: '2rem' },
  card: { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '2rem', marginBottom: '1.5rem' },
  inputGroup: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '250px', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e2e8f0', fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box', transition: 'all 0.3s' },
  error: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' },
  btn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1.25rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 32px rgba(139,92,246,0.3)' },
  loading: { textAlign: 'center', padding: '4rem 2rem' },
  mapAnimation: { position: 'relative', width: '200px', height: '200px', margin: '0 auto 2rem' },
  mapCircle: { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  mapPin: { animation: 'bounce 2s infinite', zIndex: 3 },
  ripple1: { position: 'absolute', width: '100%', height: '100%', border: '2px solid #8b5cf6', borderRadius: '50%', animation: 'ripple 2s infinite', opacity: 0 },
  ripple2: { position: 'absolute', width: '100%', height: '100%', border: '2px solid #ec4899', borderRadius: '50%', animation: 'ripple 2s infinite 0.5s', opacity: 0 },
  ripple3: { position: 'absolute', width: '100%', height: '100%', border: '2px solid #8b5cf6', borderRadius: '50%', animation: 'ripple 2s infinite 1s', opacity: 0 },
  scanLine: { position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)', animation: 'scan 2s infinite' },
  loadTitle: { fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' },
  loadText: { fontSize: '1.1rem', color: '#94a3b8' },
  results: { animation: 'fadeIn 0.5s ease' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  reportTitle: { fontSize: '2.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
  reportSub: { fontSize: '1.1rem', color: '#94a3b8' },
  newBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '0.875rem 1.75rem', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' },
  h2: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#e2e8f0' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  summaryCard: { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.3s' },
  summaryIcon: { width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 32px rgba(139,92,246,0.3)' },
  summaryContent: { flex: 1 },
  summaryLabel: { fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' },
  summaryValue: { fontSize: '2rem', fontWeight: '700', color: '#e2e8f0', lineHeight: 1 },
  summaryHint: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' },
  leadCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', marginBottom: '1rem', overflow: 'hidden', transition: 'all 0.3s' },
  leadHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', transition: 'background 0.3s' },
  leadHeaderLeft: { display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 },
  leadRank: { width: '40px', height: '40px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1rem', flexShrink: 0 },
  leadName: { fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.25rem' },
  leadCategory: { fontSize: '0.875rem', color: '#94a3b8' },
  leadHeaderRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  scoreCircle: { width: '60px', height: '60px', borderRadius: '50%', border: '3px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreText: { fontSize: '1.25rem', fontWeight: '700' },
  leadMetaBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '1rem' },
  ratingSection: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  stars: { display: 'flex', gap: '2px' },
  ratingText: { fontSize: '0.875rem', color: '#94a3b8' },
  conversionBadge: { padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  leadDetails: { padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' },
  contactSection: { marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  contactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' },
  contactItem: { display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
  contactLabel: { fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' },
  contactValue: { fontSize: '0.95rem', color: '#e2e8f0', wordBreak: 'break-word' },
  websiteLink: { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#8b5cf6', textDecoration: 'none', fontSize: '0.95rem', transition: 'all 0.3s' },
  insightsSection: { marginBottom: '1.5rem' },
  insightsGrid: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  insightBadge: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: '600' },
  scoreBreakdown: {},
  scoreBar: { height: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', overflow: 'hidden', position: 'relative' },
  scoreBarFill: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 1rem', transition: 'width 1s ease', borderRadius: '20px' },
  scoreBarText: { fontSize: '0.875rem', fontWeight: '700', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  recommendationsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' },
  recCard: { display: 'flex', gap: '1rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s' },
  recIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recContent: { flex: 1 },
  recTitle: { fontSize: '1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.5rem' },
  recText: { fontSize: '0.875rem', color: '#94a3b8', lineHeight: '1.5' },
};

const css = document.createElement('style');
css.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
  @keyframes ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes scan { 0% { transform: translateY(0); } 100% { transform: translateY(200px); } }
  .lead-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(139,92,246,0.2); background: rgba(255,255,255,0.05); }
  .lead-card .leadHeader:hover { background: rgba(255,255,255,0.02); }
  input:focus { outline: none; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }
  button:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(139,92,246,0.5) !important; }
  .websiteLink:hover { color: #ec4899; }
  .summaryCard:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(139,92,246,0.2); }
  .recCard:hover { transform: translateY(-2px); background: rgba(255,255,255,0.04); }
`;
document.head.appendChild(css);

export default LeadGenPage;
