import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, Sparkles, Zap, TrendingUp, Hash, Image as ImageIcon, Send, Download, Eye, Copy, Share2, CheckCircle, AlertCircle, Target, Users, BarChart3, MessageSquare, Heart, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

// Utility function to convert markdown-like text to formatted HTML
const formatText = (text) => {
  if (!text) return '';
  
  // Convert **bold** to <strong>
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br/>');
  
  // Convert bullet points
  formatted = formatted.replace(/^[•✅❌📊✍️📱💼🐦🎵🎥📌]/gm, '<span style="margin-right: 0.5rem;">$&</span>');
  
  return formatted;
};

function SociaPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // campaignId can be string or number - keep as-is from state
  const campaignId = location.state?.campaignId;
  const [session, setSession] = useState(null);
  const [brand, setBrand] = useState('');
  const [industry, setIndustry] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [toneStyle, setToneStyle] = useState('');
  const [weeklyTheme, setWeeklyTheme] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [contentRatio, setContentRatio] = useState('');
  const [ctaPreference, setCtaPreference] = useState('');
  const [weekStartDate, setWeekStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [error, setError] = useState('');

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

  const platformOptions = [
    'Instagram', 'LinkedIn', 'X (Twitter)', 'Facebook', 
    'YouTube', 'Pinterest', 'Threads', 'Reddit', 'TikTok'
  ];

  const handlePlatformToggle = (platform) => {
    setPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async () => {
    if (!brand || !industry || !targetAudience || platforms.length === 0) {
      setError('Please fill in all required fields (Brand, Industry, Target Audience, and select at least one platform)');
      return;
    }

    // Check if user is logged in
    if (!session || !session.user) {
      setError('Please log in to use SociaPlan');
      navigate('/login');
      return;
    }

    console.log('🔍 Starting SociaPlan for:', brand);
    console.log('📋 Campaign ID:', campaignId || 'Not part of campaign');

    setLoading(true);
    setError('');
    setCalendarData(null);

    try {
      console.log('🚀 Starting SociaPlan with token deduction...');
      
      // Execute with token deduction (250 tokens)
      const tokenResult = await executeWithTokens(
        session.user.id,
        'SociaPlan',
        async () => {
          console.log('🚀 Generating social media calendar...');
          
          const requestBody = {
            "Brand/Business Name": brand,
            "Industry/Niche": industry,
            "Target Audience": targetAudience,
            "Preferred Platforms": platforms,
            "Tone & Style": toneStyle || "Professional, engaging, and informative",
            "Weekly Theme or Focus": weeklyTheme || "General content mix",
            "Hashtags or Keywords": hashtags,
            "Content Type Ratio": contentRatio || "3 educational, 2 promotional, 2 engagement posts per week",
            "CTA Preference": ctaPreference || "Visit website",
            "Week Start Date": weekStartDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          };
          
          console.log('📤 Request body:', requestBody);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
          
          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/contentcalendar', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          console.log(`📥 Response received: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            
            if (response.status === 504) {
              throw new Error('⏱️ Server timeout - The workflow is taking too long. Please check if your n8n workflow is active and try again.');
            } else if (response.status === 502 || response.status === 503) {
              throw new Error('🔧 Server unavailable - The n8n workflow might be offline. Please check your n8n instance.');
            } else {
              throw new Error(`Server error: ${response.status} ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
            }
          }

          // Get response text first to check if it's empty
          const responseText = await response.text();
          console.log('📥 Raw response text:', responseText.substring(0, 200)); // Log first 200 chars
          
          if (!responseText || responseText.trim().length === 0) {
            throw new Error('Empty response received from server. The n8n workflow may have crashed or returned no data.');
          }

          let jsonResponse;
          try {
            jsonResponse = JSON.parse(responseText);
            console.log('📋 Calendar data received:', jsonResponse);
          } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.error('Response was:', responseText);
            throw new Error('Invalid JSON response from server. The workflow may have returned HTML or plain text instead of JSON.');
          }
          
          const calendarOutput = jsonResponse[0]?.output || jsonResponse.output || jsonResponse;
          
          if (!calendarOutput || Object.keys(calendarOutput).length === 0) {
            throw new Error('No calendar data in response. The workflow completed but returned empty data.');
          }
          
          return calendarOutput;
        },
        { brand, industry, targetAudience, platforms }, // Request data
        1, // Token multiplier (fixed cost)
        `Social Media Calendar: ${brand}`, // Output summary
        campaignId // Campaign ID
      );

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted
      console.log(`✅ SociaPlan completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
      console.log(`💰 Remaining tokens: ${tokenResult.tokensRemaining}`);
      
      setCalendarData(tokenResult.data);
      console.log('✨ Calendar loaded successfully!');

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
            .eq('name', 'SociaPlan')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ SociaPlan agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = `Social Media Calendar: ${brand}`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'SociaPlan',
              tokenResult.logId,
              tokenResult.data,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Calendar created but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }
    } catch (err) {
      console.error('❌ SociaPlan error:', err);
      
      if (err.name === 'AbortError') {
        setError('⏱️ Request timeout after 5 minutes - The workflow is taking longer than expected.\n\n' +
                'This could mean:\n' +
                '1. The AI is generating very detailed content\n' +
                '2. The n8n workflow needs optimization\n' +
                '3. High server load\n\n' +
                'Try reducing the number of platforms or simplifying the request.');
      } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('❌ Connection failed - This could be due to:\n' +
                '1. CORS policy blocking the request\n' +
                '2. Network connectivity issues\n' +
                '3. n8n workflow is not active\n' +
                '4. Invalid webhook URL\n\n' +
                'Please check your n8n workflow settings and ensure CORS is enabled.');
      } else {
        setError(err.message || 'Calendar generation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!calendarData) return;
    
    const dataStr = JSON.stringify(calendarData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `social-calendar-${brand}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getDayOfWeek = (dateString) => {
    // Convert date string to IST
    const date = new Date(dateString);
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      'instagram': '📸',
      'facebook': '👥',
      'twitter': '🐦',
      'linkedin': '💼',
      'tiktok': '🎵',
      'youtube': '🎥',
      'pinterest': '📌'
    };
    return icons[platform?.toLowerCase()] || '📱';
  };

  const getDayColor = (index) => {
    const colors = [
      { bg: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(239,68,68,0.15))', border: 'rgba(236,72,153,0.4)', glow: 'rgba(236,72,153,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(251,191,36,0.15))', border: 'rgba(249,115,22,0.4)', glow: 'rgba(249,115,22,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.15))', border: 'rgba(34,197,94,0.4)', glow: 'rgba(34,197,94,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,51,234,0.15))', border: 'rgba(59,130,246,0.4)', glow: 'rgba(59,130,246,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(219,39,119,0.15))', border: 'rgba(139,92,246,0.4)', glow: 'rgba(139,92,246,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(99,102,241,0.15))', border: 'rgba(14,165,233,0.4)', glow: 'rgba(14,165,233,0.3)' },
      { bg: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(251,113,133,0.15))', border: 'rgba(244,63,94,0.4)', glow: 'rgba(244,63,94,0.3)' }
    ];
    return colors[index % colors.length];
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      {!calendarData && (
        <div style={s.hero}>
          <div style={s.heroIcon}>
            <Calendar size={40} />
          </div>
          <h1 style={s.title}>SociaPlan AI</h1>
          <p style={s.subtitle}>Generate a complete week of social media content in seconds</p>
          <div style={s.featureBadges}>
            <div style={s.badge}>
              <Clock size={14} /> 7-Day Planning
            </div>
            <div style={s.badge}>
              <Sparkles size={14} /> AI-Powered
            </div>
            <div style={s.badge}>
              <TrendingUp size={14} /> Trend-Aware
            </div>
          </div>
        </div>
      )}

      <div style={s.main}>
        {!calendarData && !loading && (
          <div style={s.card}>
            <h2 style={{...s.h2, marginTop: 0}}>
              <Target size={20} /> Campaign Details
            </h2>
            
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🏢</span> Brand/Business Name *
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., MarketMuse AI"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🏭</span> Industry/Niche *
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., AI Marketing Tools, E-commerce, SaaS"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🎯</span> Target Audience *
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Startup founders, digital marketers"
                  style={s.input}
                />
              </div>
              
              <div style={{...s.formGroup, gridColumn: 'span 2'}}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📱</span> Preferred Platforms * (Select at least one)
                </label>
                <div style={s.platformGrid}>
                  {platformOptions.map(platform => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handlePlatformToggle(platform)}
                      style={{
                        ...s.platformBtn,
                        ...(platforms.includes(platform) ? s.platformBtnActive : {})
                      }}
                    >
                      {getPlatformIcon(platform)} {platform}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🎨</span> Tone & Style (Optional)
                </label>
                <input
                  type="text"
                  value={toneStyle}
                  onChange={(e) => setToneStyle(e.target.value)}
                  placeholder="e.g., Professional, witty, and inspirational"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>💡</span> Weekly Theme or Focus (Optional)
                </label>
                <input
                  type="text"
                  value={weeklyTheme}
                  onChange={(e) => setWeeklyTheme(e.target.value)}
                  placeholder="e.g., Feature Launch Week, Holiday Season"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>#️⃣</span> Hashtags or Keywords (Optional)
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="e.g., #AI #Marketing #Growth #Automation"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📊</span> Content Type Ratio (Optional)
                </label>
                <input
                  type="text"
                  value={contentRatio}
                  onChange={(e) => setContentRatio(e.target.value)}
                  placeholder="e.g., 3 educational, 2 promotional, 2 engagement"
                  style={s.input}
                />
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>🎯</span> CTA Preference (Optional)
                </label>
                <select 
                  value={ctaPreference} 
                  onChange={(e) => setCtaPreference(e.target.value)}
                  style={s.input}
                >
                  <option value="">Select CTA Type</option>
                  <option value="Visit website">Visit Website</option>
                  <option value="Download resource">Download Resource</option>
                  <option value="Sign up">Sign Up</option>
                  <option value="Contact us">Contact Us</option>
                  <option value="Learn more">Learn More</option>
                </select>
              </div>
              
              <div style={s.formGroup}>
                <label style={s.label}>
                  <span style={s.labelIcon}>📅</span> Week Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  style={s.input}
                />
              </div>
            </div>
            
            <div style={s.hint}>💡 Fill in the required fields to generate your personalized content calendar</div>
            {error && <div style={s.error}><AlertCircle size={16} /> {error}</div>}
            <button onClick={handleSubmit} style={s.btn}>
              <Sparkles size={18} /> Generate Content Calendar
            </button>
          </div>
        )}

        {loading && (
          <div style={s.loading}>
            <div style={s.calendarAnimation}>
              {/* Animated Calendar Grid */}
              <div style={s.animatedCalendar}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{...s.calendarDay, animationDelay: `${i * 0.1}s`}}>
                    <div style={s.dayNumber}>{i + 1}</div>
                    <div style={s.dayPulse}></div>
                  </div>
                ))}
              </div>
              
              {/* Timeline Animation */}
              <div style={s.timelineContainer}>
                <div style={s.timelineLine}></div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{...s.timelineNode, animationDelay: `${i * 0.2}s`}}>
                    <div style={s.nodeIcon}>
                      {['📱', '✍️', '🎨', '📊', '🚀'][i]}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Floating Icons */}
              {['📸', '💬', '❤️', '📈', '✨', '🎯'].map((icon, i) => (
                <div key={i} style={{...s.floatingIcon, animationDelay: `${i * 0.3}s`}}>
                  {icon}
                </div>
              ))}
            </div>
            
            <h2 style={s.loadTitle}>Crafting Your Perfect Week...</h2>
            <p style={s.loadText}>📅 Analyzing trends • ✍️ Writing posts • 🎨 Planning visuals</p>
            <p style={{...s.loadText, fontSize: '0.875rem', marginTop: '0.5rem', color: '#64748b'}}>
              ⏱️ This may take 2-5 minutes. AI is working hard to create amazing content!
            </p>
            <div style={s.progressBar}>
              <div style={s.progressFill}></div>
            </div>
          </div>
        )}

        {calendarData && (
          <div style={s.results}>
            <div style={s.resultHeader}>
              <div>
                <h1 style={s.reportTitle}>Your Weekly Content Calendar</h1>
                <p style={s.reportSub}>
                  Generated for {calendarData.brand?.name || brand} • 
                  {new Date(calendarData.generated_on || Date.now()).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata'
                  })} IST
                </p>
              </div>
              <button onClick={() => { 
                setCalendarData(null);
                setBrand(''); 
                setIndustry(''); 
                setTargetAudience('');
                setPlatforms([]);
                setToneStyle('');
                setWeeklyTheme('');
                setHashtags('');
                setContentRatio('');
                setCtaPreference('');
                setWeekStartDate('');
              }} style={s.newBtn}>
                <Calendar size={16} /> New Calendar
              </button>
            </div>

            {/* Brand Info Card */}
            {calendarData.brand && (
              <div style={s.brandCard}>
                <h2 style={s.h2}><Target size={20} /> Campaign Overview</h2>
                <div style={s.brandInfoGrid}>
                  <div style={s.infoItem} className="info-item">
                    <div style={s.infoLabel}>🏢 Brand</div>
                    <div style={s.infoValue}>{calendarData.brand.name}</div>
                  </div>
                  <div style={s.infoItem} className="info-item">
                    <div style={s.infoLabel}>🏭 Industry</div>
                    <div style={s.infoValue}>{calendarData.brand.industry}</div>
                  </div>
                  <div style={s.infoItem} className="info-item">
                    <div style={s.infoLabel}>🎯 Target Audience</div>
                    <div style={s.infoValue}>{calendarData.brand.audience}</div>
                  </div>
                  <div style={s.infoItem} className="info-item">
                    <div style={s.infoLabel}>💡 Weekly Theme</div>
                    <div style={s.infoValue}>{calendarData.brand.theme}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar Overview Card */}
            {calendarData.summary && (
              <div style={s.overviewCard}>
                <h2 style={s.h2}><BarChart3 size={20} /> Calendar Overview</h2>
                <div style={s.statsGrid}>
                  <div style={s.statItem}>
                    <div style={s.statIcon}>📅</div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={s.statValue}>{calendarData.calendar?.length || 7}</div>
                      <div style={s.statLabel}>Days Planned</div>
                    </div>
                  </div>
                  <div style={s.statItem}>
                    <div style={s.statIcon}>📱</div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={s.statValue}>
                        {calendarData.calendar?.reduce((total, day) => total + (day.platforms?.length || 0), 0) || 0}
                      </div>
                      <div style={s.statLabel}>Total Posts</div>
                    </div>
                  </div>
                  <div style={s.statItem}>
                    <div style={s.statIcon}>🎨</div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{...s.statValue, fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        {calendarData.summary.tone?.split(',')[0] || 'Balanced'}
                      </div>
                      <div style={s.statLabel}>Tone & Style</div>
                    </div>
                  </div>
                  <div style={s.statItem}>
                    <div style={s.statIcon}>📊</div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={s.statValue}>
                        {calendarData.summary.content_mix?.educational || 0}/
                        {calendarData.summary.content_mix?.promotional || 0}/
                        {calendarData.summary.content_mix?.engagement || 0}
                      </div>
                      <div style={s.statLabel}>Edu/Promo/Eng</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Content Cards */}
            {calendarData.calendar && (
              <div style={s.calendarGrid}>
                {calendarData.calendar.map((dayData, index) => {
                  const dayColor = getDayColor(index);
                  return (
                    <div 
                      key={index} 
                      style={{
                        ...s.dayCard, 
                        background: dayColor.bg,
                        borderColor: dayColor.border,
                        boxShadow: `0 4px 16px ${dayColor.glow}, 0 0 0 1px ${dayColor.border}`
                      }} 
                      className="day-card"
                    >
                      <div style={s.dayHeader}>
                        <div style={{...s.dayBadge, borderColor: dayColor.border, background: `linear-gradient(135deg, ${dayColor.border}, ${dayColor.glow})`}}>
                          {getDayOfWeek(dayData.date).toUpperCase()}
                        </div>
                        <div style={s.dayDate}>{formatDate(dayData.date)}</div>
                      </div>
                      
                      <div style={{...s.contentTypeBadge, borderColor: dayColor.border, background: `${dayColor.bg}`}}>
                        {dayData.type === 'Educational' && '📚'} 
                        {dayData.type === 'Promotional' && '🎯'} 
                        {dayData.type === 'Engagement' && '💬'} 
                        {dayData.type}
                      </div>
                      
                      <div style={s.postsList}>
                        <div style={s.postItem} className="post-item">
                          <div style={s.platformsList}>
                            {dayData.platforms?.map((platform, i) => (
                              <span key={i} style={{...s.platformTag, borderColor: dayColor.border}}>
                                {getPlatformIcon(platform)} {platform}
                              </span>
                            ))}
                          </div>
                          
                          <div style={s.postHook} dangerouslySetInnerHTML={{ __html: formatText(dayData.hook) }} />
                          
                          <div style={s.postCaption} dangerouslySetInnerHTML={{ 
                            __html: formatText(dayData.caption?.substring(0, 200) + (dayData.caption?.length > 200 ? '...' : ''))
                          }} />
                          
                          {dayData.hashtags && (
                            <div style={s.hashtagsList}>
                              {dayData.hashtags.slice(0, 4).map((tag, i) => (
                                <span key={i} style={{...s.hashtagTag, color: dayColor.border}}>{tag}</span>
                              ))}
                              {dayData.hashtags.length > 4 && (
                                <span style={{...s.hashtagTag, color: '#64748b'}}>+{dayData.hashtags.length - 4} more</span>
                              )}
                            </div>
                          )}
                          
                          <div style={{...s.postTime, background: `${dayColor.bg}`, borderColor: dayColor.border}}>
                            ⏰ {dayData.post_time || 'Flexible timing'}
                          </div>
                          
                          {dayData.visual && (
                            <div style={{...s.visualHint, background: `${dayColor.bg}`, borderColor: dayColor.border}}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                                <ImageIcon size={16} color={dayColor.border} />
                                <strong>Visual Format</strong>
                              </div>
                              <div style={{fontSize: '0.85rem', color: '#cbd5e1'}}>
                                {dayData.visual.split(':')[0]}
                              </div>
                            </div>
                          )}
                          
                          <div style={{...s.performanceTag, background: `${dayColor.bg}`, borderColor: dayColor.border}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                              <TrendingUp size={16} color="#10b981" />
                              <span style={{color: '#10b981', fontWeight: '700'}}>{dayData.expected_reach}</span>
                              <span style={{color: '#64748b'}}>reach</span>
                              <span style={{margin: '0 0.5rem', color: '#475569'}}>•</span>
                              <BarChart3 size={16} color="#8b5cf6" />
                              <span style={{color: '#a78bfa', fontWeight: '700'}}>{dayData.conversion_potential}</span>
                              <span style={{color: '#64748b'}}>conversion</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expandable details */}
                      <details style={s.details}>
                        <summary style={{...s.detailsSummary, borderColor: dayColor.border}}>
                          <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            <Sparkles size={16} color={dayColor.border} />
                            View Full Details
                          </span>
                        </summary>
                        <div style={{...s.detailsContent, background: `${dayColor.bg}`, borderColor: dayColor.border}}>
                          <div style={s.detailSection}>
                            <div style={s.detailTitle}>
                              <MessageSquare size={16} color={dayColor.border} />
                              Full Caption
                            </div>
                            <div style={s.detailText} dangerouslySetInnerHTML={{ __html: formatText(dayData.caption) }} />
                          </div>
                          
                          {dayData.visual && (
                            <div style={s.detailSection}>
                              <div style={s.detailTitle}>
                                <ImageIcon size={16} color={dayColor.border} />
                                Visual Details
                              </div>
                              <div style={s.detailText} dangerouslySetInnerHTML={{ __html: formatText(dayData.visual) }} />
                            </div>
                          )}
                          
                          {dayData.cta && (
                            <div style={s.detailSection}>
                              <div style={s.detailTitle}>
                                <Target size={16} color={dayColor.border} />
                                Call-to-Action
                              </div>
                              <div style={{...s.detailText, ...s.ctaBox, borderColor: dayColor.border, background: `${dayColor.bg}`}}>
                                {dayData.cta}
                              </div>
                            </div>
                          )}
                          
                          {dayData.hashtags && (
                            <div style={s.detailSection}>
                              <div style={s.detailTitle}>
                                <Hash size={16} color={dayColor.border} />
                                All Hashtags ({dayData.hashtags.length})
                              </div>
                              <div style={s.allHashtags}>
                                {dayData.hashtags.map((tag, i) => (
                                  <span key={i} style={{...s.hashtagTag, color: dayColor.border}}>{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div style={s.detailSection}>
                            <div style={s.detailTitle}>
                              <BarChart3 size={16} color={dayColor.border} />
                              Performance Metrics
                            </div>
                            <div style={s.metricsGrid}>
                              <div style={{...s.metricBox, borderColor: dayColor.border, background: `${dayColor.bg}`}}>
                                <div style={s.metricLabel}>Expected Reach</div>
                                <div style={{...s.metricValue, color: '#10b981'}}>{dayData.expected_reach}</div>
                              </div>
                              <div style={{...s.metricBox, borderColor: dayColor.border, background: `${dayColor.bg}`}}>
                                <div style={s.metricLabel}>Conversion</div>
                                <div style={{...s.metricValue, color: '#8b5cf6'}}>{dayData.conversion_potential}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div style={s.actionsCard}>
              <h2 style={s.h2}><Send size={20} /> Actions</h2>
              <div style={s.actionButtons}>
                <button style={s.actionBtn} onClick={handleDownload}>
                  <Download size={16} /> Download Calendar
                </button>
                <button style={s.actionBtn} onClick={() => window.print()}>
                  <Eye size={16} /> Print View
                </button>
                <button style={s.actionBtn} onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(calendarData, null, 2));
                  alert('Calendar data copied to clipboard!');
                }}>
                  <Copy size={16} /> Copy Data
                </button>
                <button style={s.actionBtn} onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Social Media Calendar',
                      text: `Check out this content calendar for ${brand}!`
                    }).catch(console.error);
                  }
                }}>
                  <Share2 size={16} /> Share
                </button>
              </div>
            </div>

            {/* Tracking & Goals */}
            {calendarData.tracking && (
              <div style={s.trackingCard}>
                <h2 style={s.h2}><Target size={20} /> Tracking & Goals</h2>
                <div style={s.trackingGrid}>
                  <div style={s.trackingSection} className="tracking-section">
                    <h3 style={s.trackingSubtitle}>📊 Key Metrics to Monitor</h3>
                    <div style={s.metricsList}>
                      {calendarData.tracking.key_metrics?.map((metric, i) => (
                        <div key={i} style={s.metricItem} className="metric-item">
                          <CheckCircle size={16} color="#10b981" />
                          <span>{metric}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {calendarData.tracking.goals && (
                    <div style={s.trackingSection} className="tracking-section">
                      <h3 style={s.trackingSubtitle}>🎯 Success Goals</h3>
                      <div style={s.goalsList}>
                        <div style={s.goalItem} className="goal-item">
                          <div style={s.goalLabel}>Reach Target</div>
                          <div style={s.goalValue}>{calendarData.tracking.goals.reach}</div>
                        </div>
                        <div style={s.goalItem} className="goal-item">
                          <div style={s.goalLabel}>Engagement Rate</div>
                          <div style={s.goalValue}>{calendarData.tracking.goals.engagement}</div>
                        </div>
                        <div style={s.goalItem} className="goal-item">
                          <div style={s.goalLabel}>Conversions</div>
                          <div style={s.goalValue}>{calendarData.tracking.goals.conversions}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {calendarData.summary?.trend_integration && (
                  <div style={s.trendSection}>
                    <h3 style={s.trackingSubtitle}>🔥 Trend Integration</h3>
                    <div style={s.trendTags}>
                      {calendarData.summary.trend_integration.map((trend, i) => (
                        <span key={i} style={s.trendTag} className="trend-tag">{trend}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pro Tips */}
            <div style={s.card}>
              <h2 style={s.h2}><Star size={20} /> Pro Tips</h2>
              <div style={s.tipsGrid}>
                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)'}}>
                    <Clock size={20} color="#3b82f6" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Optimal Timing</div>
                    <div style={s.tipText}>Post during peak engagement hours for your audience</div>
                  </div>
                </div>

                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)'}}>
                    <Hash size={20} color="#ec4899" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Hashtag Strategy</div>
                    <div style={s.tipText}>Mix trending and niche hashtags for maximum reach</div>
                  </div>
                </div>

                <div style={s.tipCard}>
                  <div style={{...s.tipIcon, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)'}}>
                    <Users size={20} color="#22c55e" />
                  </div>
                  <div style={s.tipContent}>
                    <div style={s.tipTitle}>Engagement First</div>
                    <div style={s.tipText}>Respond to comments within first 2 hours of posting</div>
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
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' },
  header: { padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 10 },
  backBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))', border: '1px solid rgba(59,130,246,0.3)', color: '#e2e8f0', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s', backdropFilter: 'blur(10px)' },
  hero: { textAlign: 'center', padding: '4rem 2rem 2rem', position: 'relative', zIndex: 10 },
  heroIcon: { display: 'inline-flex', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))', borderRadius: '20px', marginBottom: '1.5rem', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', boxShadow: '0 8px 32px rgba(59,130,246,0.3)', animation: 'float 3s ease-in-out infinite' },
  title: { fontSize: '3rem', fontWeight: '700', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem', animation: 'gradientFlow 3s ease infinite', backgroundSize: '200% 200%' },
  subtitle: { fontSize: '1.25rem', color: '#94a3b8', marginBottom: '2rem' },
  featureBadges: { display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' },
  badge: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,51,234,0.15))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '20px', fontSize: '0.875rem', backdropFilter: 'blur(10px)' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', position: 'relative', zIndex: 10 },
  card: { background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(147,51,234,0.08))', backdropFilter: 'blur(20px)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.95rem', fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  labelIcon: { fontSize: '1.1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' },
  input: { width: '100%', padding: '1rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', color: '#e2e8f0', fontSize: '1rem', boxSizing: 'border-box', transition: 'all 0.3s', fontFamily: 'inherit', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)' },
  platformGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' },
  platformBtn: { padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' },
  platformBtnActive: { background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.3))', border: '1px solid rgba(59,130,246,0.5)', color: '#e2e8f0', fontWeight: '600', transform: 'scale(1.05)' },
  hint: { fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', fontStyle: 'italic' },
  error: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem', whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '0.9rem' },
  btn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1.25rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 32px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)', backgroundSize: '200% 200%', animation: 'gradientFlow 3s ease infinite' },
  
  // Loading Animation Styles
  loading: { textAlign: 'center', padding: '4rem 2rem' },
  calendarAnimation: { position: 'relative', width: '100%', maxWidth: '600px', height: '400px', margin: '0 auto 2rem' },
  animatedCalendar: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem', marginBottom: '2rem' },
  calendarDay: { aspectRatio: '1', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', animation: 'pulseGrow 2s ease-in-out infinite', backdropFilter: 'blur(10px)' },
  dayNumber: { fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6', zIndex: 2 },
  dayPulse: { position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(59,130,246,0.4), transparent)', borderRadius: '12px', animation: 'radiusPulse 2s ease-in-out infinite' },
  timelineContainer: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '2px' },
  timelineLine: { width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)', position: 'relative', animation: 'lineGlow 2s ease-in-out infinite' },
  timelineNode: { position: 'absolute', width: '50px', height: '50px', background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.3))', borderRadius: '50%', border: '2px solid rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '-24px', animation: 'nodeFloat 2s ease-in-out infinite', backdropFilter: 'blur(10px)', fontSize: '1.5rem' },
  nodeIcon: { fontSize: '1.5rem' },
  floatingIcon: { position: 'absolute', fontSize: '2rem', animation: 'iconFloat 4s ease-in-out infinite', opacity: 0.6 },
  loadTitle: { fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', color: '#e2e8f0' },
  loadText: { fontSize: '1.1rem', color: '#94a3b8', marginBottom: '2rem' },
  progressBar: { width: '100%', maxWidth: '400px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', margin: '0 auto' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', borderRadius: '4px' },
  
  // Results Styles
  results: { animation: 'fadeIn 0.5s ease' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  reportTitle: { fontSize: '2.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
  reportSub: { fontSize: '1rem', color: '#94a3b8', fontStyle: 'italic' },
  newBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '0.875rem 1.75rem', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' },
  h2: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#e2e8f0' },
  
  // Brand Info Card
  brandCard: { background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(251,191,36,0.12))', backdropFilter: 'blur(20px)', border: '2px solid rgba(236,72,153,0.3)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(236,72,153,0.2), 0 0 0 1px rgba(236,72,153,0.1)' },
  brandInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' },
  infoItem: { padding: '1.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '2px solid rgba(236,72,153,0.3)', backdropFilter: 'blur(10px)', transition: 'all 0.3s' },
  infoLabel: { fontSize: '0.75rem', color: '#f9a8d4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  infoValue: { fontSize: '1.15rem', color: '#fef3c7', fontWeight: '700', lineHeight: '1.4', wordBreak: 'break-word' },
  
  // Overview Card Styles
  overviewCard: { background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,51,234,0.12))', backdropFilter: 'blur(20px)', border: '2px solid rgba(59,130,246,0.3)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(59,130,246,0.2), 0 0 0 1px rgba(59,130,246,0.1)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' },
  statItem: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15))', borderRadius: '16px', border: '2px solid rgba(16,185,129,0.3)', boxShadow: '0 4px 16px rgba(16,185,129,0.2)', transition: 'all 0.3s', backdropFilter: 'blur(10px)' },
  statIcon: { fontSize: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))', flexShrink: 0 },
  statValue: { fontSize: '1.8rem', fontWeight: '800', color: '#f1f5f9', lineHeight: 1.2, wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' },
  statLabel: { fontSize: '0.875rem', color: '#cbd5e1', fontWeight: '600', lineHeight: 1.3 },
  
  // Calendar Grid Styles
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
  dayCard: { backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '1.75rem', transition: 'all 0.3s', border: '2px solid', overflow: 'hidden' },
  dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', gap: '0.75rem' },
  dayBadge: { padding: '0.6rem 1rem', borderRadius: '10px', fontWeight: '800', fontSize: '0.75rem', border: '2px solid', letterSpacing: '0.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', flex: '0 0 auto', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis' },
  dayDate: { fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600', flex: '0 0 auto', whiteSpace: 'nowrap' },
  contentTypeBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem', marginBottom: '1.25rem', border: '2px solid', fontWeight: '700', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  postsList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  postItem: { padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s', backdropFilter: 'blur(10px)' },
  platformsList: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' },
  platformTag: { padding: '0.4rem 0.9rem', background: 'rgba(59,130,246,0.2)', borderRadius: '12px', fontSize: '0.8rem', border: '2px solid', fontWeight: '700', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  postHook: { fontSize: '1.1rem', color: '#f1f5f9', marginBottom: '1rem', fontWeight: '800', lineHeight: '1.5', wordBreak: 'break-word' },
  postCaption: { fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '1rem', lineHeight: '1.7', wordBreak: 'break-word', maxHeight: 'none' },
  hashtagsList: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' },
  hashtagTag: { fontSize: '0.8rem', fontWeight: '700', padding: '0.3rem 0.7rem', background: 'rgba(139,92,246,0.15)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)' },
  postTime: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid', fontWeight: '600', display: 'inline-block' },
  visualHint: { fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid', wordBreak: 'break-word' },
  performanceTag: { fontSize: '0.85rem', fontWeight: '600', padding: '0.8rem 1rem', borderRadius: '12px', border: '2px solid', marginTop: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
  details: { marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '2px solid rgba(255,255,255,0.1)' },
  detailsSummary: { cursor: 'pointer', fontSize: '0.95rem', color: '#93c5fd', fontWeight: '700', padding: '0.75rem 1rem', borderRadius: '10px', transition: 'all 0.3s', userSelect: 'none', border: '2px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.1)' },
  detailsContent: { marginTop: '1.25rem', padding: '1.5rem', borderRadius: '16px', border: '2px solid', backdropFilter: 'blur(10px)' },
  detailSection: { marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  detailTitle: { fontSize: '1rem', fontWeight: '700', color: '#f1f5f9', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  detailText: { fontSize: '0.95rem', color: '#cbd5e1', marginTop: '0.5rem', lineHeight: '1.8', wordBreak: 'break-word' },
  ctaBox: { padding: '1rem', borderRadius: '10px', border: '2px solid', fontWeight: '700', fontSize: '1rem', textAlign: 'center', color: '#f1f5f9' },
  allHashtags: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.75rem' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '0.75rem' },
  metricBox: { padding: '1rem', borderRadius: '12px', border: '2px solid', textAlign: 'center' },
  metricLabel: { fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: '600' },
  metricValue: { fontSize: '1.5rem', fontWeight: '800' },
  
  // Actions Card
  actionsCard: { background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(147,51,234,0.08))', backdropFilter: 'blur(20px)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  actionButtons: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))', border: '1px solid rgba(59,130,246,0.3)', color: '#e2e8f0', padding: '0.875rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.3s', fontWeight: '500', backdropFilter: 'blur(10px)' },
  
  // Tracking Card
  trackingCard: { background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.12))', backdropFilter: 'blur(20px)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: '24px', padding: '2.5rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(16,185,129,0.2), 0 0 0 1px rgba(16,185,129,0.1)' },
  trackingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' },
  trackingSection: { padding: '1.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '2px solid rgba(16,185,129,0.25)', backdropFilter: 'blur(10px)', transition: 'all 0.3s' },
  trackingSubtitle: { fontSize: '1.15rem', fontWeight: '700', color: '#f1f5f9', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  metricsList: { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  metricItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', color: '#cbd5e1', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', borderRadius: '10px', border: '2px solid rgba(16,185,129,0.2)', fontWeight: '600', transition: 'all 0.3s' },
  goalsList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  goalItem: { padding: '1.25rem', background: 'rgba(59,130,246,0.15)', borderRadius: '12px', border: '2px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(10px)', transition: 'all 0.3s' },
  goalLabel: { fontSize: '0.75rem', color: '#bae6fd', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontWeight: '700' },
  goalValue: { fontSize: '1.2rem', color: '#f1f5f9', fontWeight: '800', wordBreak: 'break-word' },
  trendSection: { padding: '1.75rem', background: 'rgba(236,72,153,0.08)', borderRadius: '16px', border: '2px solid rgba(236,72,153,0.3)', backdropFilter: 'blur(10px)' },
  trendTags: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  trendTag: { padding: '0.6rem 1.2rem', background: 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(251,113,133,0.25))', border: '2px solid rgba(236,72,153,0.4)', borderRadius: '20px', fontSize: '0.9rem', color: '#fda4af', fontWeight: '700', transition: 'all 0.3s', boxShadow: '0 2px 8px rgba(236,72,153,0.2)' },
  
  // Tips Section
  tipsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' },
  tipCard: { display: 'flex', gap: '1rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(236,72,153,0.05))', borderRadius: '16px', border: '1px solid rgba(251,191,36,0.2)', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  tipIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: '1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.5rem' },
  tipText: { fontSize: '0.875rem', color: '#94a3b8', lineHeight: '1.5' },
};

const css = document.createElement('style');
css.textContent = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
  @keyframes gradientFlow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
  @keyframes pulseGrow { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } }
  @keyframes radiusPulse { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 0.6; transform: scale(1.1); } }
  @keyframes lineGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; box-shadow: 0 0 20px rgba(59,130,246,0.8); } }
  @keyframes nodeFloat { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-10px) scale(1.1); } }
  @keyframes iconFloat { 
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.4; } 
    25% { transform: translate(30px, -30px) rotate(90deg); opacity: 0.7; }
    50% { transform: translate(0, -60px) rotate(180deg); opacity: 1; }
    75% { transform: translate(-30px, -30px) rotate(270deg); opacity: 0.7; }
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  
  input:focus, select:focus { 
    outline: none; 
    border-color: #3b82f6; 
    box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 8px 24px rgba(59,130,246,0.2);
    transform: translateY(-2px);
  }
  
  button:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 12px 48px rgba(59,130,246,0.6) !important; 
  }
  
  .platform-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .platform-btn:hover {
    transform: scale(1.08) translateY(-2px);
    background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.3));
    border-color: rgba(59,130,246,0.6);
    box-shadow: 0 8px 20px rgba(59,130,246,0.3);
  }
  
  .stat-item:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 12px 40px rgba(16,185,129,0.4);
    border-color: rgba(16,185,129,0.5);
  }
  
  .day-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .day-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }
  
  .post-item:hover {
    background: rgba(59,130,246,0.15);
    border-color: rgba(59,130,246,0.4);
    transform: translateX(6px);
    box-shadow: 0 4px 16px rgba(59,130,246,0.2);
  }
  
  .action-btn:hover {
    background: linear-gradient(135deg, rgba(59,130,246,0.35), rgba(147,51,234,0.35));
    border-color: rgba(59,130,246,0.6);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(59,130,246,0.4);
  }
  
  .tip-card:hover {
    transform: translateY(-6px) scale(1.03);
    background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(236,72,153,0.15));
    box-shadow: 0 12px 40px rgba(251,191,36,0.3);
    border-color: rgba(251,191,36,0.4);
  }
  
  .info-item:hover {
    transform: translateY(-4px);
    background: rgba(255,255,255,0.08);
    border-color: rgba(236,72,153,0.5);
    box-shadow: 0 8px 24px rgba(236,72,153,0.3);
  }
  
  .tracking-section:hover {
    transform: translateY(-4px);
    background: rgba(255,255,255,0.08);
    border-color: rgba(16,185,129,0.4);
    box-shadow: 0 8px 24px rgba(16,185,129,0.3);
  }
  
  .metric-item:hover {
    background: rgba(16,185,129,0.15);
    border-color: rgba(16,185,129,0.4);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(16,185,129,0.2);
  }
  
  .goal-item:hover {
    background: rgba(59,130,246,0.2);
    border-color: rgba(59,130,246,0.5);
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(59,130,246,0.3);
  }
  
  .trend-tag:hover {
    background: linear-gradient(135deg, rgba(236,72,153,0.35), rgba(251,113,133,0.35));
    border-color: rgba(236,72,153,0.6);
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 6px 16px rgba(236,72,153,0.3);
  }
  
  details summary {
    transition: all 0.3s ease;
  }
  
  details summary:hover {
    background: rgba(59,130,246,0.2);
    color: #bfdbfe;
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(59,130,246,0.2);
  }
  
  details[open] summary {
    color: #93c5fd;
    margin-bottom: 1rem;
    background: rgba(59,130,246,0.15);
  }
  
  select {
    cursor: pointer;
  }
  
  select option {
    background: #1e293b;
    color: #e2e8f0;
    padding: 0.5rem;
  }
  
  strong {
    color: #f1f5f9;
    font-weight: 700;
  }
  
  /* Positioning for floating icons */
  .floating-icon:nth-child(1) { top: 10%; left: 10%; }
  .floating-icon:nth-child(2) { top: 20%; right: 15%; animation-delay: 0.5s; }
  .floating-icon:nth-child(3) { bottom: 30%; left: 20%; animation-delay: 1s; }
  .floating-icon:nth-child(4) { top: 40%; right: 10%; animation-delay: 1.5s; }
  .floating-icon:nth-child(5) { bottom: 15%; left: 15%; animation-delay: 2s; }
  .floating-icon:nth-child(6) { top: 60%; right: 25%; animation-delay: 2.5s; }
  
  /* Timeline node positioning */
  .timeline-node:nth-child(2) { left: 0%; }
  .timeline-node:nth-child(3) { left: 25%; }
  .timeline-node:nth-child(4) { left: 50%; }
  .timeline-node:nth-child(5) { left: 75%; }
  .timeline-node:nth-child(6) { left: 100%; }
  
  /* Smooth text rendering */
  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Word wrap for all text */
  p, div, span {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
`;
document.head.appendChild(css);

export default SociaPlanPage;
