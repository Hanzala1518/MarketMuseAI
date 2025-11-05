import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';
import './ClipGenPage.css';

function ClipGenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = location.state?.campaignId;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [sourceUrl, setSourceUrl] = useState('');
  const [clipStyle, setClipStyle] = useState('mix');
  const [maxClips, setMaxClips] = useState(5);

  const clipStyleOptions = [
    { value: 'viral_hooks', label: 'Viral Hooks', desc: 'Bold statements, shocking revelations (15-30s)' },
    { value: 'key_takeaways', label: 'Key Takeaways', desc: 'Quotable insights, summary statements (20-45s)' },
    { value: 'actionable_advice', label: 'Actionable Advice', desc: 'Step-by-step instructions, how-to segments (30-60s)' },
    { value: 'statistical_highlights', label: 'Statistical Highlights', desc: 'Data reveals, research findings (20-40s)' },
    { value: 'storytelling_anecdotes', label: 'Storytelling', desc: 'Complete mini-stories with setup & resolution (45-90s)' },
    { value: 'emotional_peaks', label: 'Emotional Peaks', desc: 'Genuine laughter, passionate delivery (15-45s)' },
    { value: 'controversial_statements', label: 'Controversial', desc: 'Hot takes, debatable opinions (20-35s)' },
    { value: 'qa_segments', label: 'Q&A Segments', desc: 'Question-answer pairs (30-60s)' },
    { value: 'transformation_moments', label: 'Transformation', desc: 'Before/after, breakthrough realizations (40-70s)' },
    { value: 'expert_insights', label: 'Expert Insights', desc: 'Unique perspectives, insider knowledge (30-50s)' },
    { value: 'relatable_struggles', label: 'Relatable Struggles', desc: 'Common pain points, vulnerability (25-45s)' },
    { value: 'myth_busting', label: 'Myth Busting', desc: 'Debunk misconceptions, challenge wisdom (30-50s)' },
    { value: 'mix', label: 'Mix (Recommended)', desc: 'Blend multiple styles for maximum engagement' }
  ];

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
    if (!sourceUrl.trim()) {
      alert('Please enter a YouTube video URL');
      return;
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(sourceUrl.trim())) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const requestData = {
        source_url: sourceUrl.trim(),
        clip_style: clipStyle,
        max_clips: maxClips
      };

      const outputSummary = `${maxClips} ${clipStyle.replace('_', ' ')} clips from video`;

      const tokenResult = await executeWithTokens(
        session.user.id,
        'ClipGen',
        async () => {
          console.log('🚀 Sending request to ClipGen webhook...');
          console.log('Request data:', JSON.stringify([requestData], null, 2));
          
          const response = await fetch('https://glowing-g79w8.crab.containers.automata.host/webhook/Clipgen', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([requestData])
          });

          console.log('📡 Response status:', response.status);
          console.log('📡 Response headers:', [...response.headers.entries()]);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ClipGen API Error:', errorText);
            throw new Error(`ClipGen API error: ${response.status} - ${errorText}`);
          }

          const responseText = await response.text();
          console.log('📝 Raw response text length:', responseText?.length || 0);
          console.log('📝 Raw response text:', responseText);
          
          if (!responseText || responseText.trim() === '') {
            console.error('❌ Empty response received from webhook');
            throw new Error('Empty response from ClipGen webhook');
          }

          let data;
          try {
            data = JSON.parse(responseText);
            console.log('✅ Parsed JSON successfully:', data);
          } catch (parseError) {
            console.error('❌ Failed to parse JSON:', responseText);
            console.error('Parse error:', parseError);
            throw new Error('Invalid JSON response from ClipGen webhook');
          }

          console.log('✅ ClipGen Response:', JSON.stringify(data, null, 2));
          return data;
        },
        requestData,
        1, // token multiplier
        outputSummary
      );

      if (tokenResult.success) {
        // Extract data from the nested structure
        let outputData = tokenResult.data; // Changed from tokenResult.result to tokenResult.data
        
        console.log('ClipGen raw result:', JSON.stringify(outputData, null, 2));
        console.log('Type of raw result:', typeof outputData);
        console.log('Is array?', Array.isArray(outputData));
        
        // Handle array wrapper - n8n returns [{output: {...}}]
        if (Array.isArray(outputData) && outputData.length > 0) {
          console.log('Unwrapping array, first element:', outputData[0]);
          outputData = outputData[0];
          console.log('After array unwrap:', outputData);
          console.log('Type after array unwrap:', typeof outputData);
        }
        
        // Handle output wrapper - extract the actual data
        if (outputData && typeof outputData === 'object' && outputData.output) {
          console.log('Found output property, unwrapping...');
          outputData = outputData.output;
          console.log('After output unwrap:', outputData);
          console.log('Type after output unwrap:', typeof outputData);
        }

        console.log('Final extracted data:', JSON.stringify(outputData, null, 2));
        
        // Validate the data structure
        if (!outputData || typeof outputData !== 'object') {
          console.error('Invalid data structure. Expected format: {metadata, clips[], strategy, notes}');
          console.error('Received:', outputData);
          console.error('Type:', typeof outputData);
          alert('Received invalid data format from ClipGen. Data is not an object. Please try again.');
          return;
        }

        if (!outputData.clips || !Array.isArray(outputData.clips)) {
          console.error('Invalid data structure. Missing clips array.');
          console.error('Has clips property?', 'clips' in outputData);
          console.error('Clips value:', outputData.clips);
          console.error('Full data:', outputData);
          alert('Received invalid data format from ClipGen. Missing clips array. Please try again.');
          return;
        }

        if (outputData.clips.length === 0) {
          console.warn('No clips generated');
          alert('No clips were generated. Try adjusting your parameters or using a different video.');
          return;
        }

        console.log('Validation passed! Setting result with', outputData.clips.length, 'clips');
        setResult(outputData);

        // Handle campaign task completion - use the unwrapped data
        if (campaignId) {
          await handleCampaignTaskCompletion(
            campaignId,
            session.user.id,
            'ClipGen',
            outputData, // Use unwrapped data
            outputSummary
          );
        }
      } else {
        alert(tokenResult.message || 'Failed to generate clips');
      }
    } catch (error) {
      console.error('ClipGen Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformColor = (platform) => {
    const colors = {
      'TikTok': '#00f2ea',
      'Instagram Reels': '#e4405f',
      'Instagram': '#e4405f',
      'YouTube Shorts': '#ff0000',
      'YouTube': '#ff0000',
      'LinkedIn': '#0077b5',
      'Twitter/X': '#1da1f2',
      'X': '#1da1f2'
    };
    return colors[platform] || '#6366f1';
  };

  const getViralityColor = (score) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="clipgen-container">
      {/* Animated Background */}
      <div className="clipgen-bg-animation">
        <div className="clipgen-orb clipgen-orb-1"></div>
        <div className="clipgen-orb clipgen-orb-2"></div>
        <div className="clipgen-orb clipgen-orb-3"></div>
      </div>

      {/* Header */}
      <div className="clipgen-header">
        <button className="clipgen-back-btn" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <div className="clipgen-title-section">
          <div className="clipgen-icon-wrapper">
            <svg className="clipgen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              <path d="M8 12h.01M12 12h.01M16 12h.01" />
            </svg>
          </div>
          <div>
            <h1 className="clipgen-title">ClipGen</h1>
            <p className="clipgen-subtitle">Transform long-form content into viral short-form clips</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="clipgen-content">
        {/* Input Form */}
        <div className="clipgen-input-card">
          <h2 className="clipgen-section-title">🎬 Video Source</h2>
          
          <div className="clipgen-form-group">
            <label className="clipgen-label">
              YouTube Video URL
              <span className="clipgen-required">*</span>
            </label>
            <input
              type="url"
              className="clipgen-input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={loading}
            />
            <p className="clipgen-hint">Enter the full YouTube URL of the video you want to clip</p>
          </div>

          <div className="clipgen-form-group">
            <label className="clipgen-label">
              Clip Style
              <span className="clipgen-required">*</span>
            </label>
            <select
              className="clipgen-select"
              value={clipStyle}
              onChange={(e) => setClipStyle(e.target.value)}
              disabled={loading}
            >
              {clipStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="clipgen-hint">
              {clipStyleOptions.find(o => o.value === clipStyle)?.desc}
            </p>
          </div>

          <div className="clipgen-form-group">
            <label className="clipgen-label">
              Maximum Clips: {maxClips}
            </label>
            <div className="clipgen-slider-container">
              <input
                type="range"
                className="clipgen-slider"
                min="1"
                max="10"
                value={maxClips}
                onChange={(e) => setMaxClips(parseInt(e.target.value))}
                disabled={loading}
              />
              <div className="clipgen-slider-labels">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
            <p className="clipgen-hint">Number of viral clips to generate (more clips = more options)</p>
          </div>

          <div className="clipgen-token-cost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Cost: <strong>350 tokens</strong></span>
          </div>

          <button
            className={`clipgen-generate-btn ${loading ? 'clipgen-loading' : ''}`}
            onClick={handleGenerate}
            disabled={loading || !sourceUrl.trim()}
          >
            {loading ? (
              <>
                <div className="clipgen-spinner"></div>
                Analyzing Video & Generating Clips...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Generate Viral Clips
              </>
            )}
          </button>
        </div>

        {/* Results Display */}
        {result && (
          <div className="clipgen-results">
            {/* Metadata Summary */}
            {result.metadata && (
              <div className="clipgen-metadata-card">
                <h2 className="clipgen-section-title">📊 Video Analysis</h2>
                <div className="clipgen-metadata-grid">
                  <div className="clipgen-metadata-item">
                    <span className="clipgen-metadata-label">Source</span>
                    <span className="clipgen-metadata-value">{result.metadata.source_title || 'N/A'}</span>
                  </div>
                  <div className="clipgen-metadata-item">
                    <span className="clipgen-metadata-label">Duration</span>
                    <span className="clipgen-metadata-value">
                      {result.metadata.source_duration_sec 
                        ? `${Math.floor(result.metadata.source_duration_sec / 60)}:${(result.metadata.source_duration_sec % 60).toFixed(0).padStart(2, '0')}` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="clipgen-metadata-item">
                    <span className="clipgen-metadata-label">Clips Generated</span>
                    <span className="clipgen-metadata-value clipgen-highlight">{result.metadata.clips_generated || 0}</span>
                  </div>
                  <div className="clipgen-metadata-item">
                    <span className="clipgen-metadata-label">Total Virality Score</span>
                    <span className="clipgen-metadata-value clipgen-highlight">{result.metadata.total_virality_score || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Clips Display */}
            {result.clips && result.clips.length > 0 ? (
              <div className="clipgen-clips-section">
                <h2 className="clipgen-section-title">
                  🎯 Generated Clips ({result.clips.length})
                </h2>
                <div className="clipgen-clips-grid">
                  {result.clips.map((clip) => (
                    <div key={clip.clip_id} className="clipgen-clip-card">
                      {/* Clip Header */}
                      <div className="clipgen-clip-header">
                        <div className="clipgen-clip-rank">
                          <span className="clipgen-rank-badge">#{clip.rank}</span>
                          <span className="clipgen-clip-id">Clip {clip.clip_id}</span>
                        </div>
                        <div 
                          className="clipgen-virality-badge"
                          style={{ 
                            backgroundColor: `${getViralityColor(clip.virality_score)}20`,
                            color: getViralityColor(clip.virality_score),
                            borderColor: getViralityColor(clip.virality_score)
                          }}
                        >
                          🔥 {clip.virality_score}/100
                        </div>
                      </div>

                      {/* Timestamps */}
                      {clip.timestamps && (
                        <div className="clipgen-timestamps">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span>
                            {clip.timestamps.start}s - {clip.timestamps.end}s 
                            <span className="clipgen-duration">({clip.timestamps.duration_sec}s)</span>
                          </span>
                        </div>
                      )}

                      {/* Transcript */}
                      {clip.transcript && (
                        <div className="clipgen-transcript">
                          <p className="clipgen-transcript-label">📝 Transcript:</p>
                          <p className="clipgen-transcript-text">"{clip.transcript}"</p>
                        </div>
                      )}

                      {/* Caption */}
                      {clip.caption && (
                        <div className="clipgen-caption">
                          <p className="clipgen-caption-label">💬 Caption:</p>
                          <p className="clipgen-caption-text">{clip.caption}</p>
                          <button 
                            className="clipgen-copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(clip.caption);
                              alert('Caption copied to clipboard!');
                            }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      )}

                      {/* Platforms */}
                      {clip.platforms && clip.platforms.length > 0 && (
                        <div className="clipgen-platforms">
                          <p className="clipgen-platforms-label">📱 Best for:</p>
                          <div className="clipgen-platform-tags">
                            {clip.platforms.map((platform, idx) => (
                              <span 
                                key={idx} 
                                className={`clipgen-platform-tag ${platform === clip.best_platform ? 'clipgen-platform-best' : ''}`}
                                style={{
                                  borderColor: platform === clip.best_platform ? getPlatformColor(platform) : undefined,
                                  color: platform === clip.best_platform ? getPlatformColor(platform) : undefined
                                }}
                              >
                                {platform}
                                {platform === clip.best_platform && ' ⭐'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="clipgen-no-clips">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>No clips were generated. Try a different clip style or video.</p>
              </div>
            )}

            {/* Strategy Section */}
            {result.strategy && (
              <div className="clipgen-strategy-card">
                <h2 className="clipgen-section-title">📅 Content Strategy</h2>
                
                {/* Hashtags */}
                {result.strategy.hashtags && result.strategy.hashtags.length > 0 && (
                  <div className="clipgen-strategy-section">
                    <h3 className="clipgen-strategy-subtitle">Recommended Hashtags</h3>
                    <div className="clipgen-hashtags">
                      {result.strategy.hashtags.map((tag, idx) => (
                        <span key={idx} className="clipgen-hashtag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posting Schedule */}
                {result.strategy.posting_schedule && result.strategy.posting_schedule.length > 0 && (
                  <div className="clipgen-strategy-section">
                    <h3 className="clipgen-strategy-subtitle">Posting Schedule</h3>
                    <div className="clipgen-schedule-grid">
                      {result.strategy.posting_schedule.map((schedule, idx) => (
                        <div key={idx} className="clipgen-schedule-item">
                          <span className="clipgen-schedule-clip">Clip {schedule.clip_id}</span>
                          <span className="clipgen-schedule-day">{schedule.day}</span>
                          <span className="clipgen-schedule-time">{schedule.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {result.notes && (
              <div className="clipgen-notes-card">
                <h3 className="clipgen-notes-title">💡 Notes</h3>
                <p className="clipgen-notes-text">{result.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipGenPage;
