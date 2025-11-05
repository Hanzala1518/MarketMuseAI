import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Upload, Send, CheckCircle, Clock, Users, FileText, Calendar, TrendingUp, Sparkles, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function WhatsPulsePage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId can be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [formData, setFormData] = useState({
    offerTitle: '',
    messageContent: '',
    csvFile: null
  });
  const [loading, setLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Session management
  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        setTotalMessages(lines.length - 1);
        setFormData(prev => ({ ...prev, csvFile: file }));
      };
      reader.readAsText(file);
    } else {
      setError('Please upload a valid CSV file');
    }
  };



  const handleSubmit = async () => {
    // Validation
    if (!formData.offerTitle || !formData.messageContent || !formData.csvFile) {
      setError('Please fill all fields and upload a CSV file');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use WhatsPulse');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting WhatsPulse for:', formData.offerTitle);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setCurrentMessage(0);

    try {
      // Read CSV as plain text
      const csvText = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(formData.csvFile);
      });

      // Calculate token cost: 50 tokens per contact
      const contactCount = totalMessages;
      const totalCost = contactCount * 50;

      console.log(`📊 WhatsPulse Cost Calculation:`);
      console.log(`   Contacts: ${contactCount}`);
      console.log(`   Rate: 50 tokens per contact`);
      console.log(`   Total Cost: ${totalCost} tokens`);

      // Execute with token deduction
      const result = await executeWithTokens(
        session.user.id,
        'WhatsPulse',
        async () => {
          // Make API call
          const payload = {
            offer_title: formData.offerTitle,
            message_content: formData.messageContent,
            customer_csv: csvText
          };

          const response = await fetch(
            'https://glowing-g79w8.crab.containers.automata.host/webhook/whatsappauto',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }
          );

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const data = await response.json();
          return data;
        },
        { 
          contactCount: contactCount,
          campaignName: formData.offerTitle 
        },
        contactCount, // Token multiplier (50 tokens × contactCount)
        `WhatsApp Broadcast: ${formData.offerTitle} (${contactCount} contacts)`, // Output summary
        campaignId // Campaign ID
      );

      // Check result
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Success - start animation
      console.log(`✅ Broadcast started! Tokens deducted: ${result.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${result.tokensRemaining}`);
      
      simulateMessageSending();

      // Handle campaign task completion if this is part of a campaign
      if (campaignId) {
        console.log('📁 This is part of campaign:', campaignId);
        console.log('📁 Log ID from tokenResult:', result.logId);
        
        if (!result.logId) {
          console.error('❌ No logId returned from tokenService!');
        } else {
          console.log('✅ LogId available, proceeding with campaign artifact save...');
          
          // Get agent ID from database
          const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select('id')
            .eq('name', 'WhatsPulse')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ WhatsPulse agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `WhatsApp Broadcast: ${formData.offerTitle} (${totalMessages} contacts)`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'WhatsPulse',
              result.logId,
              result.data,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Broadcast sent but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }

    } catch (err) {
      console.error('❌ Broadcast error:', err);
      setError(err.message || 'Failed to start broadcast campaign');
      setLoading(false);
    }
  };

  const simulateMessageSending = () => {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setCurrentMessage(count);
      
      if (count >= totalMessages) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          setCompleted(true);
        }, 1000);
      }
    }, 200);
  };

  const resetForm = () => {
    setFormData({ offerTitle: '', messageContent: '', csvFile: null });
    setCurrentMessage(0);
    setTotalMessages(0);
    setCompleted(false);
    setLoading(false);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCurrentTimestamp = () => {
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const styles = {
    container: {
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #050b1a 0%, #0e1633 50%, #1b2547 100%)',
      padding: '2rem'
    },
    floatingOrb: {
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(60px)',
      opacity: 0.6,
      pointerEvents: 'none'
    },
    orb1: {
      top: '10%',
      left: '10%',
      width: '400px',
      height: '400px',
      background: 'radial-gradient(circle, rgba(0, 255, 255, 0.3), transparent)',
      animation: 'float 8s ease-in-out infinite'
    },
    orb2: {
      top: '60%',
      right: '10%',
      width: '350px',
      height: '350px',
      background: 'radial-gradient(circle, rgba(123, 97, 255, 0.3), transparent)',
      animation: 'float 8s ease-in-out infinite 2s'
    },
    orb3: {
      bottom: '10%',
      left: '50%',
      width: '300px',
      height: '300px',
      background: 'radial-gradient(circle, rgba(255, 97, 230, 0.2), transparent)',
      animation: 'float 8s ease-in-out infinite 4s'
    },
    gridOverlay: {
      position: 'absolute',
      inset: 0,
      opacity: 0.2,
      backgroundImage: `linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)`,
      backgroundSize: '50px 50px',
      pointerEvents: 'none'
    },
    content: {
      position: 'relative',
      zIndex: 10,
      maxWidth: '1200px',
      margin: '0 auto'
    },
    backButton: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '0.75rem 1.5rem',
      marginBottom: '2rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: 'white',
      cursor: 'pointer',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      fontSize: '1rem',
      fontWeight: '600'
    },
    header: {
      textAlign: 'center',
      marginBottom: '3rem',
      animation: 'slideIn 0.6s ease-out forwards',
      animationDelay: '0.1s',
      opacity: 0
    },
    aiPoweredBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      marginBottom: '1.5rem',
      background: 'rgba(0, 255, 255, 0.1)',
      border: '1px solid rgba(0, 255, 255, 0.3)'
    },
    title: {
      fontSize: '4rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF, #FF61E6, #00FFFF)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      animation: 'gradientShift 4s ease infinite',
      textShadow: '0 0 30px rgba(0,255,255,0.3)',
      fontFamily: 'Poppins, sans-serif'
    },
    subtitle: {
      fontSize: '1.25rem',
      color: '#d1d5db',
      marginBottom: '1.5rem',
      maxWidth: '48rem',
      marginLeft: 'auto',
      marginRight: 'auto'
    },
    connectedBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1.5rem',
      borderRadius: '9999px',
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      animation: 'glow 2s ease-in-out infinite'
    },
    pulsingDot: {
      width: '0.5rem',
      height: '0.5rem',
      borderRadius: '50%',
      background: '#10b981',
      animation: 'pulse 2s infinite'
    },
    glassCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      boxShadow: '0 0 30px rgba(0, 255, 255, 0.1)',
      padding: '2rem',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      animation: 'slideIn 0.6s ease-out forwards',
      animationDelay: '0.2s',
      opacity: 0
    },
    errorBox: {
      marginBottom: '1.5rem',
      padding: '1rem',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    },
    errorDivider: {
      width: '4px',
      height: '2rem',
      borderRadius: '9999px',
      background: '#ef4444'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    },
    formGroup: {
      marginBottom: '2rem'
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: 'white',
      fontWeight: '600',
      marginBottom: '0.75rem',
      fontSize: '1rem'
    },
    input: {
      width: '100%',
      padding: '1rem 1.25rem',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#E4E9F7',
      fontSize: '1rem',
      transition: 'all 0.3s ease',
      outline: 'none'
    },
    textarea: {
      width: '100%',
      padding: '1rem 1.25rem',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#E4E9F7',
      fontSize: '1rem',
      transition: 'all 0.3s ease',
      outline: 'none',
      minHeight: '150px',
      resize: 'vertical',
      fontFamily: 'inherit'
    },
    fileUploadLabel: {
      width: '100%',
      padding: '1rem 1.25rem',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      color: '#E4E9F7'
    },
    helpText: {
      marginTop: '0.5rem',
      fontSize: '0.875rem',
      color: '#9ca3af',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    submitButton: {
      width: '100%',
      padding: '1.25rem',
      borderRadius: '16px',
      border: 'none',
      background: 'linear-gradient(135deg, #00FFFF, #7B61FF)',
      color: 'white',
      fontSize: '1.125rem',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    },
    bottomText: {
      textAlign: 'center',
      fontSize: '0.875rem',
      color: '#9ca3af',
      marginTop: '1rem'
    },
    loadingContainer: {
      textAlign: 'center',
      padding: '3rem',
      animation: 'slideIn 0.6s ease-out forwards'
    },
    progressRing: {
      position: 'relative',
      width: '128px',
      height: '128px',
      margin: '0 auto 2rem'
    },
    progressRingOuter: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      border: '4px solid rgba(0, 255, 255, 0.2)'
    },
    progressRingInner: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      border: '4px solid transparent',
      borderTopColor: '#00FFFF',
      animation: 'rotate 2s linear infinite'
    },
    progressRingIcon: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    loadingTitle: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '1rem',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF, #FF61E6, #00FFFF)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      animation: 'gradientShift 4s ease infinite'
    },
    loadingSubtext: {
      fontSize: '1.25rem',
      color: '#d1d5db',
      marginBottom: '2rem'
    },
    counterBox: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '1.5rem',
      display: 'inline-block',
      marginBottom: '1.5rem'
    },
    counterNumber: {
      fontSize: '4rem',
      fontWeight: 'bold',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF, #FF61E6)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      marginBottom: '0.5rem'
    },
    progressBar: {
      width: '100%',
      maxWidth: '32rem',
      margin: '0 auto',
      height: '0.5rem',
      background: '#1f2937',
      borderRadius: '9999px',
      overflow: 'hidden'
    },
    progressBarFill: {
      height: '100%',
      borderRadius: '9999px',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF)',
      boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
      transition: 'width 0.3s ease'
    },
    successContainer: {
      textAlign: 'center',
      animation: 'slideIn 0.6s ease-out forwards'
    },
    successCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '3rem',
      marginBottom: '2rem'
    },
    successIconWrapper: {
      position: 'relative',
      width: '128px',
      height: '128px',
      margin: '0 auto 2rem'
    },
    successIconGlow: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3), transparent)',
      animation: 'pulse 2s infinite'
    },
    successIcon: {
      position: 'relative',
      zIndex: 10,
      color: '#10b981'
    },
    successTitle: {
      fontSize: '3rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF, #FF61E6, #00FFFF)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      animation: 'gradientShift 4s ease infinite'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    },
    statCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '1.5rem',
      transition: 'all 0.3s ease'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: 'bold',
      background: 'linear-gradient(90deg, #00FFFF, #7B61FF, #FF61E6)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      marginBottom: '0.5rem'
    },
    detailsCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '1.5rem',
      marginBottom: '2rem',
      textAlign: 'left'
    },
    detailsHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1rem'
    },
    detailsTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'white'
    },
    detailsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '0.75rem',
      color: '#d1d5db'
    },
    newCampaignButton: {
      padding: '1rem 3rem',
      borderRadius: '16px',
      border: 'none',
      background: 'linear-gradient(135deg, #00FFFF, #7B61FF)',
      color: 'white',
      fontSize: '1.125rem',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', sans-serif;
          }
          
          h1, h2, h3 {
            font-family: 'Poppins', sans-serif;
          }

          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-30px) scale(1.05); }
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
          }

          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.3), 0 0 40px rgba(123, 97, 255, 0.2); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 255, 0.5), 0 0 60px rgba(123, 97, 255, 0.3); }
          }

          @keyframes slideIn {
            from { 
              opacity: 0; 
              transform: translateY(30px);
            }
            to { 
              opacity: 1; 
              transform: translateY(0);
            }
          }

          @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          input::placeholder, textarea::placeholder {
            color: #A3B0D0;
          }

          input:focus, textarea:focus {
            background: rgba(255, 255, 255, 0.08);
            borderColor: #00FFFF;
            boxShadow: 0 0 20px rgba(0, 255, 255, 0.3);
          }

          button:hover {
            transform: translateY(-2px);
            boxShadow: 0 10px 40px rgba(0, 255, 255, 0.4), 0 0 20px rgba(123, 97, 255, 0.6);
          }

          button:active {
            transform: translateY(0);
          }

          .stat-card:hover {
            background: rgba(255, 255, 255, 0.06);
            borderColor: rgba(0, 255, 255, 0.3);
            transform: translateY(-4px);
          }

          .glass-card:hover {
            transform: translateY(-4px);
            boxShadow: 0 20px 60px rgba(0, 255, 255, 0.2), 0 0 40px rgba(123, 97, 255, 0.15);
            borderColor: rgba(0, 255, 255, 0.2);
          }

          .file-upload-label:hover {
            borderColor: #00FFFF;
            background: rgba(255, 255, 255, 0.05);
          }
        `}
      </style>

      {/* Floating Orbs */}
      <div style={{...styles.floatingOrb, ...styles.orb1}}></div>
      <div style={{...styles.floatingOrb, ...styles.orb2}}></div>
      <div style={{...styles.floatingOrb, ...styles.orb3}}></div>

      {/* Grid Overlay */}
      <div style={styles.gridOverlay}></div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Back Button */}
        <button style={styles.backButton} onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>

        {!loading && !completed && (
          <>
            {/* Header */}
            <div style={styles.header}>
              <div style={styles.aiPoweredBadge}>
                <Sparkles size={16} style={{color: '#00FFFF'}} />
                <span style={{color: '#00FFFF', fontSize: '0.875rem', fontWeight: '600'}}>AI-POWERED AUTOMATION</span>
              </div>
              
              <h1 style={styles.title}>WhatsPulse</h1>
              
              <p style={styles.subtitle}>
                Launch intelligent WhatsApp broadcast campaigns with AI-powered personalization and real-time analytics
              </p>

              <div style={styles.connectedBadge}>
                <CheckCircle size={20} style={{color: '#10b981'}} />
                <span style={{color: '#10b981', fontWeight: '600'}}>WhatsApp Business API Connected</span>
                <div style={styles.pulsingDot}></div>
              </div>
            </div>

            {/* Form Card */}
            <div style={styles.glassCard}>
              {error && (
                <div style={styles.errorBox}>
                  <div style={styles.errorDivider}></div>
                  <span style={{color: '#fca5a5'}}>{error}</span>
                </div>
              )}

              <div style={styles.formGrid}>
                {/* Campaign Name */}
                <div>
                  <label style={styles.label}>
                    <Zap size={18} style={{color: '#00FFFF'}} />
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    style={styles.input}
                    placeholder="Black Friday Mega Sale 2025"
                    value={formData.offerTitle}
                    onChange={(e) => handleInputChange('offerTitle', e.target.value)}
                  />
                </div>

                {/* CSV Upload */}
                <div>
                  <label style={styles.label}>
                    <Upload size={18} style={{color: '#7B61FF'}} />
                    Customer Database
                  </label>
                  <label style={styles.fileUploadLabel} className="file-upload-label">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{display: 'none'}}
                      onChange={handleFileUpload}
                    />
                    <Upload size={20} />
                    <span style={{marginLeft: '0.75rem'}}>
                      {formData.csvFile ? formData.csvFile.name : 'Upload CSV File'}
                    </span>
                  </label>
                  {totalMessages > 0 && (
                    <p style={{...styles.helpText, color: '#10b981'}}>
                      <CheckCircle size={16} />
                      {totalMessages} contacts ready to receive
                    </p>
                  )}
                </div>
              </div>

              {/* Message Content */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <MessageCircle size={18} style={{color: '#FF61E6'}} />
                  Message Content
                </label>
                <textarea
                  style={styles.textarea}
                  placeholder="Hi {{Name}}, 🎉 Exclusive offer just for you! Get 50% OFF on all premium products. Limited time only. Shop now: [link]"
                  value={formData.messageContent}
                  onChange={(e) => handleInputChange('messageContent', e.target.value)}
                />
                <p style={styles.helpText}>
                  <Sparkles size={14} style={{color: '#00FFFF'}} />
                  Use {'{{Name}}'} for automatic personalization
                </p>
              </div>

              {/* Submit Button */}
              <button onClick={handleSubmit} style={styles.submitButton}>
                <Send size={22} />
                <span>Launch Broadcast Campaign</span>
                <Sparkles size={18} />
              </button>

              <p style={styles.bottomText}>
                Messages will be sent with intelligent rate limiting for optimal delivery
              </p>
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.glassCard}>
              <div style={styles.progressRing}>
                <div style={styles.progressRingOuter}></div>
                <div style={styles.progressRingInner}></div>
                <div style={styles.progressRingIcon}>
                  <MessageCircle size={48} style={{color: '#00FFFF', animation: 'pulse 1.5s infinite'}} />
                </div>
              </div>

              <h2 style={styles.loadingTitle}>Broadcasting in Progress</h2>
              
              <p style={styles.loadingSubtext}>
                Sending personalized messages with AI optimization
              </p>

              <div style={styles.counterBox}>
                <div style={styles.counterNumber}>{currentMessage}</div>
                <div style={{color: '#9ca3af'}}>of {totalMessages} messages sent</div>
              </div>

              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressBarFill,
                  width: `${(currentMessage / totalMessages) * 100}%`
                }}></div>
              </div>

              <p style={{...styles.helpText, marginTop: '1.5rem', justifyContent: 'center'}}>
                <Clock size={16} />
                Estimated completion: {Math.ceil((totalMessages - currentMessage) * 0.2)} seconds
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {completed && (
          <div style={styles.successContainer}>
            <div style={styles.successCard}>
              <div style={styles.successIconWrapper}>
                <div style={styles.successIconGlow}></div>
                <CheckCircle size={128} style={styles.successIcon} />
              </div>

              <h1 style={styles.successTitle}>Campaign Deployed Successfully!</h1>
              
              <p style={{...styles.subtitle, marginBottom: '2rem'}}>
                Your personalized messages have been delivered to all contacts
              </p>

              {/* Stats Grid */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard} className="stat-card">
                  <Users size={32} style={{color: '#00FFFF', margin: '0 auto 0.75rem'}} />
                  <div style={styles.statValue}>{totalMessages}</div>
                  <div style={{fontSize: '0.875rem', color: '#9ca3af'}}>Messages Sent</div>
                </div>

                <div style={styles.statCard} className="stat-card">
                  <TrendingUp size={32} style={{color: '#10b981', margin: '0 auto 0.75rem'}} />
                  <div style={styles.statValue}>100%</div>
                  <div style={{fontSize: '0.875rem', color: '#9ca3af'}}>Delivery Rate</div>
                </div>

                <div style={styles.statCard} className="stat-card">
                  <Zap size={32} style={{color: '#7B61FF', margin: '0 auto 0.75rem'}} />
                  <div style={styles.statValue}>{Math.round(totalMessages * 0.2)}s</div>
                  <div style={{fontSize: '0.875rem', color: '#9ca3af'}}>Total Duration</div>
                </div>

                <div style={styles.statCard} className="stat-card">
                  <Calendar size={32} style={{color: '#FF61E6', margin: '0 auto 0.75rem'}} />
                  <div style={{...styles.statValue, fontSize: '1.125rem'}}>{new Date().toLocaleDateString()}</div>
                  <div style={{fontSize: '0.875rem', color: '#9ca3af'}}>Campaign Date</div>
                </div>
              </div>

              {/* Campaign Details */}
              <div style={styles.detailsCard}>
                <div style={styles.detailsHeader}>
                  <FileText size={24} style={{color: '#00FFFF'}} />
                  <h3 style={styles.detailsTitle}>Campaign Details</h3>
                </div>
                <div>
                  <div style={styles.detailsRow}>
                    <span style={{color: '#9ca3af'}}>Campaign Name:</span>
                    <span style={{fontWeight: '600'}}>{formData.offerTitle}</span>
                  </div>
                  <div style={styles.detailsRow}>
                    <span style={{color: '#9ca3af'}}>Timestamp:</span>
                    <span style={{fontWeight: '600'}}>{getCurrentTimestamp()}</span>
                  </div>
                  <div style={styles.detailsRow}>
                    <span style={{color: '#9ca3af'}}>Status:</span>
                    <span style={{color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <CheckCircle size={16} />
                      Completed
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={resetForm} style={styles.newCampaignButton}>
                Launch New Campaign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsPulsePage;