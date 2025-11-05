import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Headphones, Zap, FileAudio, Activity, Brain, Loader2, CheckCircle, AlertCircle, BarChart3, TrendingUp, Heart, MessageSquare, Target, Star } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function EchoMindPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId can be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/x-wav', 'audio/mp4'];
      if (allowedTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a)$/i)) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Please upload a valid audio file (.mp3, .wav, or .m4a)');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/x-wav', 'audio/mp4'];
      if (allowedTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a)$/i)) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Please upload a valid audio file (.mp3, .wav, or .m4a)');
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select an audio file to analyze');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use EchoMind');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting EchoMind for:', selectedFile.name);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      console.log('🚀 Starting EchoMind with token deduction...');
      
      // Execute with token deduction (150 tokens)
      const tokenResult = await executeWithTokens(
        session.user.id,
        'EchoMind',
        async () => {
          const formData = new FormData();
          formData.append("file", selectedFile);

          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/audioanlayze', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Analysis failed: ${response.status}`);
          }

          const result = await response.json();
          const analysisData = result[0]?.output || result;
          return analysisData;
        },
        { fileName: selectedFile.name, fileSize: selectedFile.size }, // Request data
        1, // Token multiplier (fixed cost)
        `Audio Analysis: ${selectedFile.name}`, // Output summary
        campaignId // Campaign ID
      );

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted
      console.log(`✅ EchoMind completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${tokenResult.tokensRemaining}`);
      
      setAnalysisResult(tokenResult.data);

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
            .eq('name', 'EchoMind')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ EchoMind agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `Audio Analysis: ${selectedFile.name}`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'EchoMind',
              tokenResult.logId,
              tokenResult.data,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Audio analysis completed but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }
    } catch (err) {
      console.error('❌ EchoMind error:', err);
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setError('');
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)',
      padding: '2rem',
    },
    maxWidth: {
      maxWidth: '1400px',
      margin: '0 auto',
    },
    backButton: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '12px 24px',
      color: 'white',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '2rem',
      fontSize: '1rem',
      fontWeight: '500',
      transition: 'all 0.3s ease',
    },
    headerCenter: {
      textAlign: 'center',
      marginBottom: '3rem',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(168, 85, 247, 0.2)',
      border: '1px solid rgba(168, 85, 247, 0.3)',
      borderRadius: '50px',
      padding: '10px 20px',
      marginBottom: '1.5rem',
      fontSize: '0.9rem',
      fontWeight: '600',
      color: '#c084fc',
    },
    title: {
      fontSize: '4rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #06b6d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    subtitle: {
      fontSize: '1.25rem',
      color: '#cbd5e1',
      maxWidth: '800px',
      margin: '0 auto',
      lineHeight: '1.8',
    },
    uploadCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: '3rem',
      maxWidth: '900px',
      margin: '0 auto',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)',
    },
    errorBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      color: '#fca5a5',
      marginBottom: '1.5rem',
    },
    uploadArea: {
      border: dragOver ? '2px solid #a855f7' : '2px dashed #64748b',
      borderRadius: '16px',
      padding: '3rem 2rem',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      background: dragOver ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.02)',
    },
    uploadIcon: {
      margin: '0 auto 1rem auto',
      color: '#a855f7',
    },
    uploadTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '0.5rem',
    },
    uploadSubtext: {
      fontSize: '1rem',
      color: '#94a3b8',
      marginBottom: '1.5rem',
    },
    chooseButton: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 32px',
      color: 'white',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '1rem',
      transition: 'all 0.3s ease',
    },
    hiddenInput: {
      display: 'none',
    },
    fileInfo: {
      marginTop: '1.5rem',
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    },
    analyzeButton: {
      width: '100%',
      background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '20px',
      color: 'white',
      fontSize: '1.125rem',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginTop: '2rem',
      transition: 'all 0.3s ease',
    },
    loadingContainer: {
      textAlign: 'center',
      paddingTop: '5rem',
      paddingBottom: '5rem',
    },
    loadingTitle: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '0.75rem',
      marginTop: '1.5rem',
    },
    loadingSubtext: {
      fontSize: '1.125rem',
      color: '#94a3b8',
    },
    resultsHeader: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    resultsTitle: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '0.5rem',
      marginTop: '1rem',
    },
    resultsSubtext: {
      color: '#94a3b8',
      fontSize: '1rem',
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem',
    },
    metricCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)',
    },
    metricHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '1rem',
    },
    iconBox: {
      padding: '12px',
      borderRadius: '12px',
    },
    metricLabel: {
      fontSize: '0.875rem',
      color: '#94a3b8',
    },
    metricValue: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: 'white',
    },
    metricText: {
      color: '#cbd5e1',
      fontSize: '0.875rem',
      lineHeight: '1.6',
    },
    metricSubtext: {
      marginTop: '0.75rem',
      fontSize: '0.75rem',
      color: '#64748b',
    },
    summaryCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '16px',
      padding: '2rem',
      marginTop: '2rem',
    },
    summaryHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '1.5rem',
    },
    summaryTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: 'white',
    },
    summarySection: {
      marginBottom: '1.5rem',
    },
    summaryLabel: {
      color: '#22c55e',
      fontWeight: '600',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem',
    },
    summaryText: {
      color: '#cbd5e1',
      lineHeight: '1.7',
      fontSize: '1rem',
    },
    resetButton: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '16px 40px',
      color: 'white',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '1rem',
      margin: '2rem auto 0 auto',
      transition: 'all 0.3s ease',
    },
    centerButton: {
      textAlign: 'center',
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(168, 85, 247, 0.3);
        }
        button:active {
          transform: translateY(0);
        }
      `}</style>

      <div style={styles.maxWidth}>
        <button style={styles.backButton} onClick={() => window.history.back()}>
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        {!loading && !analysisResult && (
          <>
            <div style={styles.headerCenter}>
              <div style={styles.badge}>
                <Brain size={18} />
                AI-Powered Analysis
              </div>
              
              <h1 style={styles.title}>EchoMind</h1>
              
              <p style={styles.subtitle}>
                Advanced conversation intelligence that decodes emotions, sentiment, and communication patterns in real-time
              </p>
            </div>

            <div style={styles.uploadCard}>
              {error && (
                <div style={styles.errorBox}>
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <div 
                style={styles.uploadArea}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileAudio size={64} style={styles.uploadIcon} />
                
                <h3 style={styles.uploadTitle}>
                  {selectedFile ? '✓ File Selected' : 'Drop your audio file here'}
                </h3>
                
                <p style={styles.uploadSubtext}>
                  or click to browse • Supports MP3, WAV, M4A
                </p>

                <button 
                  type="button"
                  style={styles.chooseButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload size={20} />
                  Choose File
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a"
                  style={styles.hiddenInput}
                  onChange={handleFileSelect}
                />
              </div>

              {selectedFile && (
                <div style={styles.fileInfo}>
                  <CheckCircle size={24} color="#22c55e" style={{flexShrink: 0, marginTop: '2px'}} />
                  <div style={{flex: 1}}>
                    <div style={{color: 'white', fontWeight: '600', fontSize: '1.125rem', marginBottom: '4px'}}>
                      {selectedFile.name}
                    </div>
                    <div style={{color: '#94a3b8', fontSize: '0.875rem'}}>
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={!selectedFile}
                style={{
                  ...styles.analyzeButton,
                  opacity: selectedFile ? 1 : 0.5,
                  cursor: selectedFile ? 'pointer' : 'not-allowed'
                }}
              >
                <Zap size={24} />
                Start Analysis
              </button>
            </div>
          </>
        )}

        {loading && (
          <div style={styles.loadingContainer}>
            <Loader2 size={64} color="#a855f7" style={{margin: '0 auto', animation: 'spin 1s linear infinite'}} />
            <h2 style={styles.loadingTitle}>Analyzing Audio...</h2>
            <p style={styles.loadingSubtext}>EchoMind is processing your conversation</p>
          </div>
        )}

        {analysisResult && (
          <>
            <div style={styles.resultsHeader}>
              <CheckCircle size={64} color="#22c55e" style={{margin: '0 auto 1rem auto'}} />
              <h2 style={styles.resultsTitle}>Analysis Complete</h2>
              <p style={styles.resultsSubtext}>Here's what we discovered about your conversation</p>
            </div>

            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(236, 72, 153, 0.2)'}}>
                    <Heart size={24} color="#ec4899" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Overall Sentiment</div>
                    <div style={styles.metricValue}>
                      {analysisResult.overall_sentiment?.label || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.overall_sentiment?.explanation || 'No data available'}
                </div>
                {analysisResult.overall_sentiment?.score && (
                  <div style={styles.metricSubtext}>
                    Score: {analysisResult.overall_sentiment.score}
                  </div>
                )}
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(168, 85, 247, 0.2)'}}>
                    <Brain size={24} color="#a855f7" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Primary Emotion</div>
                    <div style={styles.metricValue}>
                      {analysisResult.primary_emotion?.emotion || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.primary_emotion?.explanation || 'No data available'}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(59, 130, 246, 0.2)'}}>
                    <TrendingUp size={24} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Confidence</div>
                    <div style={{...styles.metricValue, color: getScoreColor(analysisResult.confidence_score?.score || 0)}}>
                      {analysisResult.confidence_score?.score || 0}%
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.confidence_score?.explanation || 'No data available'}
                </div>
                {analysisResult.confidence_score?.label && (
                  <div style={styles.metricSubtext}>
                    Status: {analysisResult.confidence_score.label}
                  </div>
                )}
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(6, 182, 212, 0.2)'}}>
                    <MessageSquare size={24} color="#06b6d4" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Communication Tone</div>
                    <div style={styles.metricValue}>
                      {analysisResult.communication_tone?.tone || 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.communication_tone?.explanation || 'No data available'}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(34, 197, 94, 0.2)'}}>
                    <Target size={24} color="#22c55e" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Conversion Chance</div>
                    <div style={{...styles.metricValue, color: getScoreColor(analysisResult.client_conversion_chances?.percentage || 0)}}>
                      {analysisResult.client_conversion_chances?.percentage || 0}%
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.client_conversion_chances?.explanation || 'No data available'}
                </div>
                {analysisResult.client_conversion_chances?.label && (
                  <div style={styles.metricSubtext}>
                    Category: {analysisResult.client_conversion_chances.label}
                  </div>
                )}
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(251, 146, 60, 0.2)'}}>
                    <BarChart3 size={24} color="#fb923c" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Engagement</div>
                    <div style={{...styles.metricValue, color: getScoreColor(analysisResult.engagement_level?.score || 0)}}>
                      {analysisResult.engagement_level?.score || 0}%
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.engagement_level?.explanation || 'No data available'}
                </div>
                {analysisResult.engagement_level?.label && (
                  <div style={styles.metricSubtext}>
                    Level: {analysisResult.engagement_level.label}
                  </div>
                )}
              </div>
            </div>

            {analysisResult.objection_handling_score && (
              <div style={{...styles.metricCard, marginBottom: '2rem'}}>
                <div style={styles.metricHeader}>
                  <div style={{...styles.iconBox, background: 'rgba(234, 179, 8, 0.2)'}}>
                    <AlertCircle size={24} color="#eab308" />
                  </div>
                  <div>
                    <div style={styles.metricLabel}>Objection Handling</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{...styles.metricValue, color: getScoreColor(analysisResult.objection_handling_score.score || 0)}}>
                        {analysisResult.objection_handling_score.score}%
                      </div>
                      <span style={{color: '#64748b'}}>•</span>
                      <div style={{fontSize: '1.125rem', color: 'white'}}>
                        {analysisResult.objection_handling_score.label}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={styles.metricText}>
                  {analysisResult.objection_handling_score.explanation}
                </div>
              </div>
            )}

            {analysisResult.summary && (
              <div style={styles.summaryCard}>
                <div style={styles.summaryHeader}>
                  <Star size={28} color="#22c55e" />
                  <h3 style={styles.summaryTitle}>Executive Summary</h3>
                </div>

                <div style={styles.summarySection}>
                  <div style={styles.summaryLabel}>Overview</div>
                  <p style={styles.summaryText}>
                    {analysisResult.summary.text}
                  </p>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem'}}>
                  <div>
                    <div style={{...styles.summaryLabel, color: '#3b82f6'}}>Call Outcome</div>
                    <p style={styles.summaryText}>
                      {analysisResult.summary.outcome}
                    </p>
                  </div>

                  <div>
                    <div style={{...styles.summaryLabel, color: '#a855f7'}}>Next Action</div>
                    <p style={styles.summaryText}>
                      {analysisResult.summary.next_action}
                    </p>
                  </div>
                </div>

                <div>
                  <div style={{...styles.summaryLabel, color: '#06b6d4'}}>Recommendation</div>
                  <p style={styles.summaryText}>
                    {analysisResult.summary.recommendation}
                  </p>
                </div>
              </div>
            )}

            <div style={styles.centerButton}>
              <button onClick={resetForm} style={styles.resetButton}>
                <FileAudio size={20} />
                Analyze Another Recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EchoMindPage;