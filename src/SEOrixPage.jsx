import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, TrendingUp, Target, BarChart3, CheckCircle, AlertCircle, Loader2, Zap, Brain, FileText, ChevronDown, ChevronUp, Globe, Code, Activity, Clock, Award, Users, Link, ExternalLink, Sparkles, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function SEOrixPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId can be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const reportRef = useRef(null);
  const abortControllerRef = useRef(null);

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
    if (!url) {
      setError('Please enter a website URL');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use SEOrix');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting SEO analysis for:', url);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('🚀 Starting SEOrix with token deduction...');
      
      // Execute with token deduction (200 tokens)
      const tokenResult = await executeWithTokens(
        session.user.id,
        'SEOrix',
        async () => {
          // Entire API logic here
          console.log('Starting analysis for:', url);
          const startResponse = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ website_url: url })
          });

          if (!startResponse.ok) {
            throw new Error(`Failed to start analysis: ${startResponse.status}`);
          }

          const startData = await startResponse.json();
          console.log('Start response:', startData);

          let jobId = startData.job_id || startData.id || startData[0]?.job_id || startData[0]?.id;

          if (!jobId) {
            console.log('No job_id found, processing immediate response');
            let report = null;
            if (Array.isArray(startData) && startData[0]?.output?.seo_report) {
              report = startData[0].output.seo_report;
            } else if (startData[0]?.seo_report) {
              report = startData[0].seo_report;
            } else if (startData.output?.seo_report) {
              report = startData.output.seo_report;
            } else if (startData.seo_report) {
              report = startData.seo_report;
            } else {
              report = startData;
            }
            return report;
          }

          // Poll for results
          console.log('Job started with ID:', jobId);
          const pollInterval = 5000;
          const maxAttempts = 120;
          let attempts = 0;

          return new Promise((resolve, reject) => {
            const checkStatus = async () => {
              if (abortControllerRef.current?.signal.aborted) {
                reject(new Error('Analysis cancelled'));
                return;
              }

              attempts++;
              console.log(`Polling attempt ${attempts}/${maxAttempts}`);

              if (attempts > maxAttempts) {
                reject(new Error('Analysis timed out after 10 minutes. Please try again.'));
                return;
              }

              try {
                const statusResponse = await fetch(
                  `https://glowing-g79w8.crab.containers.automata.host/webhook/seo/status/${jobId}`,
                  { method: 'GET', headers: { 'Content-Type': 'application/json' } }
                );

                if (!statusResponse.ok) {
                  throw new Error(`Status check failed: ${statusResponse.status}`);
                }

                const statusData = await statusResponse.json();
                console.log('Status response:', statusData);

                const status = statusData.status || statusData[0]?.status;

                if (status === 'completed' || status === 'success') {
                  let report = null;
                  if (statusData.result) {
                    report = statusData.result;
                  } else if (statusData.output?.seo_report) {
                    report = statusData.output.seo_report;
                  } else if (statusData.seo_report) {
                    report = statusData.seo_report;
                  } else if (Array.isArray(statusData) && statusData[0]?.output?.seo_report) {
                    report = statusData[0].output.seo_report;
                  } else if (Array.isArray(statusData) && statusData[0]?.seo_report) {
                    report = statusData[0].seo_report;
                  } else {
                    report = statusData;
                  }

                  console.log('Analysis completed, report:', report);
                  resolve(report);
                } else if (status === 'failed' || status === 'error') {
                  const errorMsg = statusData.error || statusData.message || 'Analysis failed';
                  reject(new Error(errorMsg));
                } else {
                  console.log('Still processing, will poll again...');
                  setTimeout(checkStatus, pollInterval);
                }
              } catch (pollError) {
                console.warn('Status endpoint failed, trying direct fetch:', pollError.message);
                
                try {
                  const resultResponse = await fetch(
                    `https://glowing-g79w8.crab.containers.automata.host/webhook/seo/${jobId}`,
                    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
                  );

                  if (resultResponse.ok) {
                    const resultData = await resultResponse.json();
                    let report = null;
                    
                    if (Array.isArray(resultData) && resultData[0]?.output?.seo_report) {
                      report = resultData[0].output.seo_report;
                    } else if (resultData[0]?.seo_report) {
                      report = resultData[0].seo_report;
                    } else if (resultData.output?.seo_report) {
                      report = resultData.output.seo_report;
                    } else if (resultData.seo_report) {
                      report = resultData.seo_report;
                    } else {
                      report = resultData;
                    }

                    if (report) {
                      console.log('Got result from direct fetch:', report);
                      resolve(report);
                      return;
                    }
                  }
                } catch (directError) {
                  console.warn('Direct fetch also failed:', directError.message);
                }
                
                setTimeout(checkStatus, pollInterval);
              }
            };

            checkStatus();
          });
        },
        { url }, // Request data
        1, // Token multiplier (fixed cost)
        `SEO Report for ${url}`, // Output summary
        campaignId // Campaign ID (if part of campaign)
      );

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted
      console.log(`✅ SEOrix completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${tokenResult.tokensRemaining}`);
      console.log(`📊 Raw API data:`, tokenResult.data);
      
      // Parse the data - handle different response structures
      let parsedData = tokenResult.data;
      
      // If data is wrapped in array
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        parsedData = parsedData[0];
      }
      
      // If data is wrapped in output or seo_report
      if (parsedData?.output?.seo_report) {
        parsedData = parsedData.output.seo_report;
      } else if (parsedData?.seo_report) {
        parsedData = parsedData.seo_report;
      } else if (parsedData?.output) {
        parsedData = parsedData.output;
      }
      
      console.log(`📊 Parsed data for display:`, parsedData);
      
      if (!parsedData || typeof parsedData !== 'object') {
        setError('Invalid response format from API');
        setLoading(false);
        return;
      }
      
      setResult(parsedData);
      setExpanded({ critical: true, high: true });

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
            .eq('name', 'SEOrix')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ SEOrix agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `SEO Report for ${url}`;
            
            console.log('📁 Calling handleCampaignTaskCompletion with:', {
              campaignId,
              agentId,
              agentName: 'SEOrix',
              logId: tokenResult.logId,
              outputSummary
            });
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'SEOrix',
              tokenResult.logId,
              parsedData,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              console.log('✅ Task marked as complete');
              // Show success notification
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ SEO analysis completed but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }

    } catch (err) {
      console.error('❌ SEOrix error:', err);
      setError(err.message || 'SEO analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setError('Analysis cancelled');
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const getColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  const getGrade = (grade) => {
    const icons = { Excellent: '🟢', Good: '🟢', Fair: '🟠', Poor: '🔴' };
    return icons[grade] || '⚪';
  };

  const report = result;

  // Debug: Log report structure when it changes
  React.useEffect(() => {
    if (report) {
      console.log('🔍 Report data structure:', {
        hasScore: report.score !== undefined,
        hasGrade: report.grade !== undefined,
        hasSummary: report.summary !== undefined,
        hasUrl: report.url !== undefined,
        hasDate: report.date !== undefined,
        hasKeywords: report.keywords !== undefined,
        hasContent: report.content !== undefined,
        hasMeta: report.meta !== undefined,
        hasTechnical: report.technical !== undefined,
        hasBacklinks: report.backlinks !== undefined,
        hasRecommendations: report.recommendations !== undefined,
        fullReport: report
      });
    }
  }, [report]);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      {!result && (
        <div style={s.hero}>
          <div style={s.heroIcon}>
            <Brain size={48} />
            <Sparkles size={24} style={s.sparkle} />
          </div>
          <h1 style={s.title}>SEOrix AI Analysis</h1>
          <p style={s.subtitle}>Deep dive into your website's SEO performance with AI-powered insights</p>
        </div>
      )}

      <div style={s.main}>
        {!result && !loading && (
          <div style={s.inputCard}>
            <div style={s.inputWrapper}>
              <Globe size={20} style={s.inputIcon} />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                style={s.input}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {error && <div style={s.error}><AlertCircle size={16} /> {error}</div>}
            <button onClick={handleSubmit} style={s.btn}>
              <Search size={20} /> Analyze Website
              <div style={s.btnGlow}></div>
            </button>
          </div>
        )}

        {loading && (
          <div style={s.loading}>
            <div style={s.loaderWrapper}>
              <div style={s.loaderRing}></div>
              <div style={s.loaderRing2}></div>
              <Brain size={48} style={s.loaderIcon} />
            </div>
            <h2 style={s.loadTitle}>AI is analyzing your website...</h2>
            <p style={s.loadText}>Examining SEO, performance, content quality & competitive landscape</p>
            <p style={s.loadSubtext}>This may take a few minutes. Please wait...</p>
            <div style={s.loadingBar}>
              <div style={s.loadingBarFill}></div>
            </div>
            <button onClick={handleCancel} style={s.cancelBtn}>
              <AlertCircle size={18} /> Cancel Analysis
            </button>
          </div>
        )}

        {report && (
          <div style={s.results} ref={reportRef}>
            {/* Header */}
            <div style={s.resultHeader}>
              <div>
                <div style={s.badge2}>✨ Analysis Complete</div>
                <h1 style={s.reportTitle}>SEO Analysis Report</h1>
                <p style={s.reportUrl}>{report.url || report.website_url || 'Website Analysis'}</p>
                <p style={s.reportDate}>📅 {report.date ? new Date(report.date).toLocaleDateString() : new Date().toLocaleDateString()}</p>
              </div>
              <div style={s.headerActions}>
                <button onClick={handlePrintPDF} style={s.pdfBtn} className="no-print">
                  <Download size={18} /> Export PDF
                </button>
                <button onClick={() => setResult(null)} style={s.newBtn} className="no-print">
                  <Search size={18} /> New Analysis
                </button>
              </div>
            </div>

            {/* Score Overview */}
            <div style={s.scoreCard}>
              <div style={s.scoreMain}>
                <div style={s.scoreCircleWrapper}>
                  <svg style={s.scoreSvg} viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12"/>
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="90" 
                      fill="none" 
                      stroke={getColor(report.score || 0)} 
                      strokeWidth="12" 
                      strokeDasharray={`${(report.score || 0) * 5.65} 565`} 
                      strokeLinecap="round" 
                      transform="rotate(-90 100 100)" 
                      style={s.scoreProgress}
                    />
                  </svg>
                  <div style={s.scoreText}>
                    <span style={{...s.scoreNum, color: getColor(report.score || 0)}}>{report.score || 0}</span>
                    <span style={s.scoreMax}>/100</span>
                  </div>
                </div>
                <div style={s.scoreInfo}>
                  <h2 style={s.scoreTitle}>Overall SEO Score</h2>
                  <div style={s.gradeTag}>
                    {getGrade(report.grade || 'Poor')} {report.grade || 'Not Available'}
                  </div>
                  <p style={s.scoreSummary}>{report.summary || 'Analysis complete. Check details below.'}</p>
                </div>
              </div>
            </div>

            {/* Keywords */}
            {report.keywords && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Target size={24} /> Keyword Performance</h2>
                  <span style={s.count}>{report.keywords.length} keywords tracked</span>
                </div>
                <div style={s.kwGrid}>
                  {report.keywords.map((kw, i) => (
                    <div key={i} style={{...s.kwCard, borderLeft: `4px solid ${kw.opportunity === 'Very High' ? '#10b981' : kw.opportunity === 'High' ? '#3b82f6' : '#94a3b8'}`}}>
                      <div style={s.kwTop}>
                        <div style={s.kwName}>{kw.keyword}</div>
                        <div style={{...s.oppBadge, background: kw.opportunity === 'Very High' ? 'rgba(16,185,129,0.2)' : kw.opportunity === 'High' ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.2)'}}>
                          {kw.opportunity}
                        </div>
                      </div>
                      <div style={s.kwStats}>
                        <div style={s.kwStat}>
                          <span style={s.kwLabel}>Rank</span>
                          <strong style={s.kwVal}>{kw.rank || 'Not ranked'}</strong>
                        </div>
                        <div style={s.kwStat}>
                          <span style={s.kwLabel}>Volume</span>
                          <strong style={s.kwVal}>{kw.volume.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Analysis */}
            {report.content && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><FileText size={24} /> Content Analysis</h2>
                </div>
                <div style={s.contentGrid}>
                  <div style={s.statCard}>
                    <div style={{...s.statIcon, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <div style={s.statLabel}>Word Count</div>
                      <div style={s.statValue}>{report.content.words}</div>
                    </div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{...s.statIcon, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
                      <Award size={24} />
                    </div>
                    <div>
                      <div style={s.statLabel}>Readability</div>
                      <div style={s.statValue}>{report.content.readability}</div>
                    </div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{...s.statIcon, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <div style={s.statLabel}>Heading Tags</div>
                      <div style={s.statValue}>H1:{report.content.h_tags.h1} H2:{report.content.h_tags.h2} H3:{report.content.h_tags.h3}</div>
                    </div>
                  </div>
                </div>
                
                {report.content.issues && (
                  <div style={s.issuesBox}>
                    <h4 style={s.h4}>⚠️ Issues Found</h4>
                    <div style={s.issuesList}>
                      {report.content.issues.map((issue, i) => (
                        <div key={i} style={s.issueItem}>
                          <AlertCircle size={16} style={{flexShrink: 0}} />
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.content.recommendations && (
                  <div style={s.recBox}>
                    <h4 style={s.h4}>💡 Recommendations</h4>
                    <div style={s.recList}>
                      {report.content.recommendations.map((rec, i) => (
                        <div key={i} style={s.recItem}>
                          <CheckCircle size={16} style={{flexShrink: 0, color: '#10b981'}} />
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meta Tags */}
            {report.meta && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Code size={24} /> Meta Tags & Schema</h2>
                </div>
                <div style={s.metaGrid}>
                  <div style={s.metaCard}>
                    <div style={s.metaTop}>
                      <strong>Title Tag</strong>
                      <CheckCircle size={18} color="#10b981" />
                    </div>
                    <p style={s.metaContent}>{report.meta.title}</p>
                  </div>
                  <div style={s.metaCard}>
                    <div style={s.metaTop}>
                      <strong>Meta Description</strong>
                      <AlertCircle size={18} color="#f59e0b" />
                    </div>
                    <p style={s.metaContent}>{report.meta.description}</p>
                  </div>
                  <div style={s.metaCard}>
                    <div style={s.metaTop}>
                      <strong>Canonical URL</strong>
                      <CheckCircle size={18} color="#10b981" />
                    </div>
                    <p style={s.metaContent}>{report.meta.canonical}</p>
                  </div>
                  <div style={s.metaCard}>
                    <div style={s.metaTop}>
                      <strong>Open Graph</strong>
                      {report.meta.open_graph ? <CheckCircle size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
                    </div>
                    <p style={s.metaContent}>{report.meta.open_graph ? 'Configured' : 'Missing'}</p>
                  </div>
                  <div style={s.metaCard}>
                    <div style={s.metaTop}>
                      <strong>Twitter Card</strong>
                      {report.meta.twitter_card ? <CheckCircle size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
                    </div>
                    <p style={s.metaContent}>{report.meta.twitter_card ? 'Configured' : 'Missing'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Technical SEO */}
            {report.technical && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Activity size={24} /> Technical Performance</h2>
                </div>
                <div style={s.techGrid}>
                  <div style={s.techCard}>
                    <div style={s.techScore}>
                      <div style={{...s.techCircle, borderColor: getColor(report.technical.pagespeed_mobile)}}>
                        <span style={{color: getColor(report.technical.pagespeed_mobile)}}>{report.technical.pagespeed_mobile}</span>
                      </div>
                      <div style={s.techLabel}>Mobile Score</div>
                    </div>
                  </div>
                  <div style={s.techCard}>
                    <div style={s.techScore}>
                      <div style={{...s.techCircle, borderColor: getColor(report.technical.pagespeed_desktop)}}>
                        <span style={{color: getColor(report.technical.pagespeed_desktop)}}>{report.technical.pagespeed_desktop}</span>
                      </div>
                      <div style={s.techLabel}>Desktop Score</div>
                    </div>
                  </div>
                  <div style={s.techCard}>
                    <div style={s.techStatus}>
                      {report.technical.https ? <CheckCircle size={32} color="#10b981" /> : <AlertCircle size={32} color="#ef4444" />}
                      <div style={s.techLabel}>HTTPS {report.technical.https ? 'Enabled' : 'Disabled'}</div>
                    </div>
                  </div>
                </div>

                {report.technical.broken_links?.length > 0 && (
                  <div style={s.brokenBox}>
                    <h4 style={s.h4}>🔗 Broken Links ({report.technical.broken_links.length})</h4>
                    <div style={s.brokenList}>
                      {report.technical.broken_links.slice(0, 5).map((link, i) => (
                        <div key={i} style={s.brokenItem}>
                          <Link size={14} />
                          <code style={s.brokenCode}>{link}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Competitors */}
            {report.competitors && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Users size={24} /> Competitor Analysis</h2>
                </div>
                <div style={s.compGrid}>
                  {report.competitors.map((comp, i) => (
                    <div key={i} style={s.compCard}>
                      <div style={s.compHeader}>
                        <strong style={s.compName}>{comp.name}</strong>
                        <div style={{...s.compScore, background: `linear-gradient(135deg, ${getColor(comp.seo_score)}, ${getColor(comp.seo_score)}dd)`}}>
                          {comp.seo_score}
                        </div>
                      </div>
                      <div style={s.compStats}>
                        <div style={s.compStat}>
                          <span style={s.compLabel}>Top 10 Keywords</span>
                          <strong>{comp.keywords_top10}</strong>
                        </div>
                        <div style={s.compStat}>
                          <span style={s.compLabel}>Word Count</span>
                          <strong>{comp.word_count.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Fixes */}
            {report.priority_fixes && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Zap size={24} /> Priority Action Items</h2>
                </div>
                {Object.entries(report.priority_fixes).map(([priority, items]) => items?.length > 0 && (
                  <div key={priority} style={s.prioritySection}>
                    <div style={s.priorityHeader} onClick={() => toggle(priority)}>
                      <h3 style={s.priorityTitle}>
                        {priority === 'critical' && '🔥'}
                        {priority === 'high' && '⚡'}
                        {priority === 'medium' && '🧩'}
                        {priority === 'low' && '📌'}
                        {' '}{priority.toUpperCase()} PRIORITY
                        <span style={s.priorityCount}>{items.length}</span>
                      </h3>
                      {expanded[priority] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    {expanded[priority] && (
                      <div style={s.priorityItems}>
                        {items.map((item, i) => (
                          <div key={i} style={s.priorityItem}>
                            <CheckCircle size={16} style={{flexShrink: 0, color: '#8b5cf6'}} />
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Expected Impact */}
            {report.expected_impact && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><TrendingUp size={24} /> Expected Impact</h2>
                </div>
                <div style={s.impactGrid}>
                  <div style={s.impactCard}>
                    <div style={s.impactLabel}>SEO Score</div>
                    <div style={s.impactChange}>
                      <span style={s.impactCurrent}>{report.expected_impact.seo_score.current}</span>
                      <span style={s.impactArrow}>→</span>
                      <span style={s.impactProjected}>{report.expected_impact.seo_score.projected}</span>
                      <span style={s.impactIncrease}>+{report.expected_impact.seo_score.projected - report.expected_impact.seo_score.current}</span>
                    </div>
                  </div>
                  <div style={s.impactCard}>
                    <div style={s.impactLabel}>Mobile Performance</div>
                    <div style={s.impactChange}>
                      <span style={s.impactCurrent}>{report.expected_impact.performance_mobile.current}</span>
                      <span style={s.impactArrow}>→</span>
                      <span style={s.impactProjected}>{report.expected_impact.performance_mobile.projected}</span>
                      <span style={s.impactIncrease}>+{report.expected_impact.performance_mobile.projected - report.expected_impact.performance_mobile.current}</span>
                    </div>
                  </div>
                </div>
                
                {report.expected_impact.core_web_vitals && (
                  <div style={s.vitalsBox}>
                    <h4 style={s.h4}>Core Web Vitals Improvement</h4>
                    <div style={s.vitalsGrid}>
                      <div style={s.vitalCard}>
                        <span style={s.vitalName}>LCP</span>
                        <span style={s.vitalVal}>{report.expected_impact.core_web_vitals.lcp}</span>
                      </div>
                      <div style={s.vitalCard}>
                        <span style={s.vitalName}>INP</span>
                        <span style={s.vitalVal}>{report.expected_impact.core_web_vitals.inp}</span>
                      </div>
                      <div style={s.vitalCard}>
                        <span style={s.vitalName}>CLS</span>
                        <span style={s.vitalVal}>{report.expected_impact.core_web_vitals.cls}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Next Steps */}
            {report.next_steps && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.h2}><Clock size={24} /> Action Timeline</h2>
                </div>
                {Object.entries(report.next_steps).map(([week, tasks]) => tasks?.length > 0 && (
                  <div key={week} style={s.timelineCard}>
                    <div style={s.timelineHeader}>
                      <div style={s.timelineDot}></div>
                      <h4 style={s.timelineTitle}>{week.replace(/_/g, ' ').toUpperCase()}</h4>
                    </div>
                    <div style={s.timelineTasks}>
                      {tasks.map((task, i) => (
                        <div key={i} style={s.timelineTask}>
                          <CheckCircle size={14} color="#10b981" />
                          {task}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1629 100%)', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' },
  header: { padding: '1.5rem 2rem', borderBottom: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,14,39,0.8)' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s ease' },
  hero: { textAlign: 'center', padding: '5rem 2rem 3rem', position: 'relative' },
  heroIcon: { position: 'relative', display: 'inline-flex', padding: '2rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))', borderRadius: '30px', marginBottom: '2rem', border: '2px solid rgba(139,92,246,0.3)', boxShadow: '0 0 60px rgba(139,92,246,0.3)', color: '#8b5cf6' },
  sparkle: { position: 'absolute', top: '10px', right: '10px', color: '#fbbf24', animation: 'sparkle 2s infinite' },
  title: { fontSize: '3.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #c084fc, #e879f9, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem', letterSpacing: '-0.02em' },
  subtitle: { fontSize: '1.25rem', color: '#a5b4fc', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', position: 'relative', zIndex: 1 },
  inputCard: { maxWidth: '600px', margin: '0 auto', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '24px', padding: '3rem', boxShadow: '0 20px 60px rgba(139,92,246,0.2)' },
  inputWrapper: { position: 'relative', marginBottom: '1.5rem' },
  inputIcon: { position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', zIndex: 1 },
  input: { width: '100%', padding: '1.25rem 1.25rem 1.25rem 3.5rem', background: 'rgba(139,92,246,0.05)', border: '2px solid rgba(139,92,246,0.2)', borderRadius: '16px', color: '#e2e8f0', fontSize: '1rem', outline: 'none', transition: 'all 0.3s ease', boxSizing: 'border-box' },
  error: { display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' },
  btn: { position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1.5rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 10px 40px rgba(139,92,246,0.4)' },
  btnGlow: { position: 'absolute', inset: '-2px', background: 'linear-gradient(135deg, #c084fc, #e879f9)', filter: 'blur(20px)', opacity: 0.5, zIndex: -1 },
  loading: { textAlign: 'center', padding: '5rem 2rem' },
  loaderWrapper: { position: 'relative', width: '120px', height: '120px', margin: '0 auto 2rem' },
  loaderRing: { position: 'absolute', inset: 0, border: '4px solid rgba(139,92,246,0.2)', borderTop: '4px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loaderRing2: { position: 'absolute', inset: '15px', border: '4px solid rgba(236,72,153,0.2)', borderTop: '4px solid #ec4899', borderRadius: '50%', animation: 'spin 1.5s linear infinite reverse' },
  loaderIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#c4b5fd', animation: 'pulse 2s infinite' },
  loadTitle: { fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', background: 'linear-gradient(135deg, #c084fc, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  loadText: { fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '0.5rem' },
  loadSubtext: { fontSize: '0.95rem', color: '#94a3b8', marginBottom: '2rem', fontStyle: 'italic' },
  loadingBar: { maxWidth: '400px', height: '4px', background: 'rgba(139,92,246,0.2)', borderRadius: '2px', margin: '0 auto 2rem', overflow: 'hidden' },
  loadingBarFill: { height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', animation: 'loading 2s ease infinite', borderRadius: '2px' },
  cancelBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '1rem 2rem', borderRadius: '16px', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', transition: 'all 0.3s ease', marginTop: '1rem' },
  results: { animation: 'fadeIn 0.8s ease' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  headerActions: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  pdfBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', padding: '1rem 2rem', borderRadius: '16px', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', boxShadow: '0 10px 30px rgba(16,185,129,0.3)' },
  badge2: { display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '20px', fontSize: '0.875rem', color: '#6ee7b7', marginBottom: '1rem', fontWeight: '600' },
  reportTitle: { fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #c084fc, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
  reportUrl: { fontSize: '1rem', color: '#a5b4fc', marginBottom: '0.25rem' },
  reportDate: { fontSize: '0.9rem', color: '#94a3b8' },
  newBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1rem 2rem', borderRadius: '16px', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', boxShadow: '0 10px 30px rgba(139,92,246,0.3)' },
  scoreCard: { background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1))', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px', padding: '3rem', marginBottom: '2rem', boxShadow: '0 20px 60px rgba(139,92,246,0.2)' },
  scoreMain: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3rem', alignItems: 'center' },
  scoreCircleWrapper: { position: 'relative', width: '200px', height: '200px' },
  scoreSvg: { width: '100%', height: '100%', transform: 'rotate(0deg)' },
  scoreProgress: { transition: 'stroke-dasharray 2s ease' },
  scoreText: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' },
  scoreNum: { display: 'block', fontSize: '3.5rem', fontWeight: '800', lineHeight: 1 },
  scoreMax: { fontSize: '1.25rem', color: '#94a3b8', fontWeight: '600' },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: '1.75rem', fontWeight: '700', marginBottom: '1rem', color: '#e2e8f0' },
  gradeTag: { display: 'inline-block', padding: '0.75rem 1.5rem', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '16px', fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem' },
  scoreSummary: { fontSize: '1.1rem', lineHeight: '1.7', color: '#cbd5e1' },
  card: { background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: '20px', padding: '2.5rem', marginBottom: '2rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  h2: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  h4: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#e2e8f0' },
  count: { padding: '0.5rem 1rem', background: 'rgba(139,92,246,0.2)', borderRadius: '12px', fontSize: '0.875rem', color: '#c4b5fd', fontWeight: '600' },
  kwGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  kwCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', transition: 'all 0.3s ease', cursor: 'pointer' },
  kwTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' },
  kwName: { fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', lineHeight: '1.4' },
  oppBadge: { padding: '0.375rem 0.875rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)' },
  kwStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  kwStat: { display: 'flex', flexDirection: 'column' },
  kwLabel: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' },
  kwVal: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  statCard: { display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  statIcon: { width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 },
  statLabel: { fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' },
  statValue: { fontSize: '1.5rem', fontWeight: '700', color: '#e2e8f0' },
  issuesBox: { padding: '1.5rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', marginBottom: '1.5rem' },
  issuesList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  issueItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fca5a5', lineHeight: '1.6' },
  recBox: { padding: '1.5rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px' },
  recList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  recItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#cbd5e1', lineHeight: '1.6' },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
  metaCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  metaTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  metaContent: { fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', wordBreak: 'break-word' },
  techGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  techCard: { padding: '2rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)', textAlign: 'center' },
  techScore: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
  techCircle: { width: '80px', height: '80px', borderRadius: '50%', border: '6px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: '800' },
  techLabel: { fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '600' },
  techStatus: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
  brokenBox: { padding: '1.5rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px' },
  brokenList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  brokenItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fca5a5' },
  brokenCode: { fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '6px', color: '#fca5a5', fontFamily: 'monospace' },
  compGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' },
  compCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  compHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  compName: { fontSize: '1.25rem', color: '#e2e8f0' },
  compScore: { padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '700', color: 'white' },
  compStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  compStat: { display: 'flex', flexDirection: 'column' },
  compLabel: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' },
  prioritySection: { marginBottom: '1rem' },
  priorityHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s ease', border: '1px solid rgba(139,92,246,0.1)' },
  priorityTitle: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  priorityCount: { padding: '0.25rem 0.75rem', background: 'rgba(139,92,246,0.3)', borderRadius: '12px', fontSize: '0.875rem', marginLeft: '0.5rem' },
  priorityItems: { padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 16px 16px', marginTop: '-8px' },
  priorityItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1', lineHeight: '1.6' },
  impactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  impactCard: { padding: '2rem', background: 'rgba(16,185,129,0.05)', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' },
  impactLabel: { fontSize: '0.95rem', color: '#6ee7b7', marginBottom: '1rem', fontWeight: '600' },
  impactChange: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '800' },
  impactCurrent: { color: '#94a3b8' },
  impactArrow: { color: '#6ee7b7' },
  impactProjected: { color: '#10b981' },
  impactIncrease: { fontSize: '1.25rem', color: '#10b981', background: 'rgba(16,185,129,0.2)', padding: '0.25rem 0.75rem', borderRadius: '12px' },
  vitalsBox: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px' },
  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
  vitalCard: { padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', textAlign: 'center' },
  vitalName: { display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' },
  vitalVal: { display: 'block', fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600' },
  timelineCard: { position: 'relative', paddingLeft: '2rem', marginBottom: '2rem', borderLeft: '2px solid rgba(139,92,246,0.3)' },
  timelineHeader: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  timelineDot: { position: 'absolute', left: '-9px', width: '16px', height: '16px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', borderRadius: '50%', border: '3px solid #0a0e27' },
  timelineTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#c4b5fd', textTransform: 'capitalize', margin: 0 },
  timelineTasks: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  timelineTask: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(139,92,246,0.03)', borderRadius: '12px', color: '#cbd5e1', lineHeight: '1.6' },
};

const css = document.createElement('style');
css.textContent = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
@keyframes fadeIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes sparkle{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.2) rotate(180deg)}}
@keyframes loading{0%{transform:translateX(-100%)}50%{transform:translateX(0)}100%{transform:translateX(100%)}}

@media print {
  body { background: white !important; }
  .no-print { display: none !important; }
  div[style*="background: linear-gradient"] { background: white !important; color: black !important; }
  div[style*="border:"] { border: 1px solid #ccc !important; }
  * { color: black !important; }
  h1, h2, h3, h4 { color: #333 !important; }
  @page { margin: 1cm; }
}
`;
document.head.appendChild(css);

export default SEOrixPage;