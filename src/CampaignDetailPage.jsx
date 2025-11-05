import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  getCampaignById,
  updateCampaign,
  addAgentToCampaign,
  removeAgentFromCampaign,
  getAllAgents
} from './services/campaignService';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  FileText,
  Calendar,
  Zap,
  Download,
  ChevronDown
} from 'lucide-react';

const CampaignDetailPage = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' or 'artifacts'
  const [allAgents, setAllAgents] = useState([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [expandedArtifact, setExpandedArtifact] = useState(null);

  // Helper function to render artifact output based on agent type
  const renderArtifactOutput = (artifact) => {
    const { agent_name, output_data } = artifact;
    
    if (!output_data) {
      console.warn(`No output_data for agent: ${agent_name}`);
      return <div style={styles.noData}>No data available</div>;
    }

    // Debug log to help diagnose data structure issues
    console.log(`Rendering ${agent_name}:`, {
      isArray: Array.isArray(output_data),
      hasOutput: Array.isArray(output_data) && output_data[0]?.output !== undefined,
      structure: Array.isArray(output_data) ? 'array' : typeof output_data,
      keys: typeof output_data === 'object' ? Object.keys(output_data).slice(0, 5) : []
    });

    try {
      // SEOrix - SEO Report
      if (agent_name === 'SEOrix') {
        // Handle both wrapped and direct formats
        const data = Array.isArray(output_data) && output_data[0]?.output 
          ? output_data[0].output 
          : output_data.output || output_data;
        return (
          <div style={styles.formattedOutput}>
            {data.title && <h3 style={styles.outputTitle}>🎯 {data.title}</h3>}
            {data.website_url && <p style={styles.outputMeta}>Website: {data.website_url}</p>}
            
            {data.recommendations && Object.entries(data.recommendations).map(([priority, items]) => (
              <div key={priority} style={styles.recommendationSection}>
                <h4 style={styles.priorityTitle}>
                  {priority === 'critical' && '🔴'}
                  {priority === 'high' && '🟠'}
                  {priority === 'medium' && '🟡'}
                  {priority === 'low' && '🟢'}
                  {' '}{priority.toUpperCase()} Priority
                </h4>
                <ul style={styles.recommendationList}>
                  {items.map((item, idx) => (
                    <li key={idx} style={styles.recommendationItem}>
                      <strong>{item.issue}:</strong> {item.recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }
      
      // LeadGen - Lead List
      if (agent_name === 'LeadGen') {
        const leads = output_data[0]?.output?.scored_leads || output_data.scored_leads || output_data;
        if (Array.isArray(leads)) {
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>📊 Generated {leads.length} Leads</h3>
              {leads.map((lead, idx) => (
                <div key={idx} style={styles.leadCard}>
                  <div style={styles.leadHeader}>
                    <strong>{lead.companyName}</strong>
                    <span style={{...styles.badge, background: lead.leadScore >= 70 ? '#10b981' : lead.leadScore >= 50 ? '#f59e0b' : '#ef4444'}}>
                      {lead.leadScore}/100
                    </span>
                  </div>
                  <div style={styles.leadDetails}>
                    <div>📞 {lead.phoneNumber || 'Not Available'}</div>
                    <div>📧 {lead.emailAddress || 'Not Available'}</div>
                    <div>📍 {lead.exactAddress}</div>
                    <div>⭐ {lead.rating} ({lead.ratingCount} reviews)</div>
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }
      
      // SociaPlan - Social Media Calendar
      if (agent_name === 'SociaPlan') {
        // Handle both wrapped and direct formats
        const data = Array.isArray(output_data) && output_data[0]?.output 
          ? output_data[0].output 
          : output_data.output || output_data;
        const calendar = data.weekly_calendar || data;
        return (
          <div style={styles.formattedOutput}>
            <h3 style={styles.outputTitle}>📅 Weekly Content Calendar</h3>
            {calendar.brand_info && (
              <div style={styles.calendarBrand}>
                <p><strong>Brand:</strong> {calendar.brand_info.brand_name}</p>
                <p><strong>Industry:</strong> {calendar.brand_info.industry}</p>
              </div>
            )}
            {Object.entries(calendar).filter(([key]) => key.startsWith('day_')).map(([day, post]) => (
              <div key={day} style={styles.socialPost}>
                <h4 style={styles.dayTitle}>{post.day}</h4>
                <p><strong>Time:</strong> {post.post_time}</p>
                <p><strong>Platform:</strong> {post.platform}</p>
                <p><strong>Content:</strong> {post.content}</p>
                <p><strong>Hashtags:</strong> {post.hashtags}</p>
              </div>
            ))}
          </div>
        );
      }
      
      // EchoMind - Audio Analysis
      if (agent_name === 'EchoMind') {
        // Handle both wrapped and direct formats
        const data = Array.isArray(output_data) && output_data[0]?.output 
          ? output_data[0].output 
          : output_data.output || output_data;
        return (
          <div style={styles.formattedOutput}>
            <h3 style={styles.outputTitle}>🎵 Audio Analysis Results</h3>
            {data.sentiment_analysis && (
              <div style={styles.analysisSection}>
                <h4>Sentiment Analysis</h4>
                <p><strong>Overall Sentiment:</strong> {data.sentiment_analysis.overall_sentiment}</p>
                <p><strong>Tone:</strong> {data.sentiment_analysis.tone}</p>
              </div>
            )}
            {data.key_moments && (
              <div style={styles.analysisSection}>
                <h4>Key Moments</h4>
                <ul>
                  {data.key_moments.map((moment, idx) => (
                    <li key={idx}>{moment}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }

      // WhatsPulse - Broadcast Results
      if (agent_name === 'WhatsPulse') {
        // Handle both wrapped and direct formats
        const data = Array.isArray(output_data) && output_data[0]?.output 
          ? output_data[0].output 
          : output_data.output || output_data;
        return (
          <div style={styles.formattedOutput}>
            <h3 style={styles.outputTitle}>💬 Broadcast Campaign Results</h3>
            {data.campaign_summary && (
              <div style={styles.broadcastStats}>
                <p><strong>Total Sent:</strong> {data.campaign_summary.total_messages_sent}</p>
                <p><strong>Success Rate:</strong> {data.campaign_summary.success_rate}%</p>
                <p><strong>Campaign Name:</strong> {data.campaign_summary.campaign_name}</p>
              </div>
            )}
          </div>
        );
      }

      // AdVisor - Ad Creative (has imageUrl)
      if (agent_name === 'AdVisor') {
        // Handle both wrapped and direct formats
        const data = Array.isArray(output_data) && output_data[0]?.output 
          ? output_data[0].output 
          : output_data.output || output_data;
        return (
          <div style={styles.formattedOutput}>
            <h3 style={styles.outputTitle}>🎨 Ad Creative Generated</h3>
            {data.imageUrl ? (
              <img 
                src={data.imageUrl} 
                alt="Ad Creative" 
                style={styles.adImage}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div style={{...styles.imagePlaceholder, display: data.imageUrl ? 'none' : 'flex'}}>
              <div style={styles.placeholderIcon}>🎨</div>
              <div style={styles.placeholderText}>
                {data.imageUrl ? 'Image failed to load' : 'No image available'}
              </div>
            </div>
            <div style={styles.adDetails}>
              <p><strong>Headline:</strong> {data.headline}</p>
              <p><strong>Sub-heading:</strong> {data.subHeading}</p>
              <p><strong>CTA:</strong> {data.cta}</p>
              <p><strong>Button:</strong> {data.buttonText}</p>
            </div>
          </div>
        );
      }

      // Scriptly - Video Script Variations
      if (agent_name === 'Scriptly') {
        const scriptData = Array.isArray(output_data) ? output_data[0]?.output : output_data.output || output_data;
        if (scriptData) {
          const variationKeys = Object.keys(scriptData).filter(key => key.startsWith('variation_'));
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>🎬 Script Variations ({variationKeys.length})</h3>
              {variationKeys.map((key, index) => {
                const variation = scriptData[key];
                return (
                  <div key={key} style={styles.scriptVariation}>
                    <div style={styles.scriptHeader}>
                      <h4 style={styles.variationTitle}>Variation {index + 1}: {variation.title}</h4>
                      <span style={styles.retentionBadge}>📊 {variation.estimated_retention_score}</span>
                    </div>
                    <div style={styles.scriptMeta}>
                      <p><strong>Hook Strategy:</strong> {variation.hook_strategy}</p>
                    </div>
                    <div style={styles.scriptContent}>
                      <strong>Full Script:</strong>
                      <p style={styles.scriptText}>{variation.full_script}</p>
                    </div>
                    {variation.scene_breakdown && variation.scene_breakdown.length > 0 && (
                      <div style={styles.sceneBreakdown}>
                        <strong>Scene Breakdown:</strong>
                        {variation.scene_breakdown.map((scene, sceneIdx) => (
                          <div key={sceneIdx} style={styles.sceneItem}>
                            <div style={styles.sceneTimestamp}>⏱️ {scene.timestamp}</div>
                            <div style={styles.sceneDetail}><strong>Voiceover:</strong> {scene.voiceover}</div>
                            <div style={styles.sceneDetail}><strong>Visual:</strong> {scene.visual}</div>
                            <div style={styles.sceneDetail}><strong>On-Screen:</strong> {scene.on_screen_text}</div>
                            {scene.note && <div style={styles.sceneNote}>💡 {scene.note}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={styles.whyWorks}>
                      <strong>Why This Works:</strong> {variation.why_this_works}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
      }

      // Adbrief - Ad Brief Variations
      if (agent_name === 'Adbrief') {
        const briefData = Array.isArray(output_data) ? output_data[0]?.output : output_data.output || output_data;
        if (briefData && briefData.generated_briefs) {
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>✨ Ad Brief Variations ({briefData.generated_briefs.length})</h3>
              <div style={styles.briefMeta}>
                <p><strong>Product:</strong> {briefData.product_name}</p>
                <p><strong>Target Audience:</strong> {briefData.target_audience}</p>
              </div>
              {briefData.generated_briefs.map((brief, index) => (
                <div key={index} style={styles.briefVariation}>
                  <div style={styles.briefHeader}>
                    <h4 style={styles.briefTitle}>Variation {index + 1}</h4>
                    <span style={styles.briefAngle}>{brief.variation_name}</span>
                  </div>
                  <div style={styles.briefContent}>
                    <div style={styles.briefSection}>
                      <strong>Headline:</strong>
                      <p style={styles.briefHeadline}>{brief.headline}</p>
                    </div>
                    <div style={styles.briefSection}>
                      <strong>Sub-Heading:</strong>
                      <p>{brief.sub_heading}</p>
                    </div>
                    <div style={styles.briefSection}>
                      <strong>Key Pointers:</strong>
                      <div style={styles.keyPointsList}>
                        {brief.key_pointers.split('\n').filter(p => p.trim()).map((point, i) => (
                          <div key={i} style={styles.keyPoint}>
                            {point.trim().startsWith('-') ? point.trim().substring(1).trim() : point.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={styles.ctaSection}>
                      <div style={styles.briefSection}>
                        <strong>Call to Action:</strong>
                        <p>{brief.call_to_action}</p>
                      </div>
                      <button style={styles.buttonPreview}>{brief.button_text}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }

      if (agent_name === 'TrendIQ') {
        const trendData = Array.isArray(output_data) ? output_data[0]?.output : output_data.output || output_data;
        
        // Detect output type
        const isKeywordOutput = trendData?.market_pulse && (trendData?.trending_themes || trendData?.executive_summary);
        const isLocationOutput = trendData?.trend_pulse || trendData?.top_trends_analysis;

        if (isKeywordOutput) {
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>📊 Keyword Trend Analysis</h3>
              
              {/* Executive Summary */}
              {trendData.executive_summary && (
                <div style={styles.trendHighlight}>
                  <div style={styles.trendHeader}>
                    <h4 style={styles.trendTitle}>✨ Executive Summary</h4>
                    {trendData.executive_summary.urgency_level && (
                      <span style={{
                        ...styles.urgencyBadge,
                        ...(trendData.executive_summary.urgency_level === 'high' || trendData.executive_summary.urgency_level === 'critical' 
                          ? styles.urgencyHigh
                          : trendData.executive_summary.urgency_level === 'medium' 
                          ? styles.urgencyMedium 
                          : styles.urgencyLow)
                      }}>
                        {trendData.executive_summary.urgency_level.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h4 style={styles.summaryHeadline}>{trendData.executive_summary.headline}</h4>
                  <p style={styles.summaryText}><strong>Key Insight:</strong> {trendData.executive_summary.key_insight}</p>
                  {trendData.executive_summary.recommended_action && (
                    <div style={styles.actionBox}>
                      <strong>📋 Recommended Action:</strong> {trendData.executive_summary.recommended_action}
                    </div>
                  )}
                </div>
              )}

              {/* Market Pulse Stats */}
              {trendData.market_pulse && (
                <div style={styles.trendStats}>
                  {trendData.market_pulse.data_points_analyzed && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Data Points</div>
                      <div style={styles.statValue}>{trendData.market_pulse.data_points_analyzed}</div>
                    </div>
                  )}
                  {trendData.market_pulse.overall_sentiment && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Overall Sentiment</div>
                      <div style={styles.statValue}>{trendData.market_pulse.overall_sentiment}</div>
                    </div>
                  )}
                  {trendData.market_pulse.confidence_score !== undefined && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Confidence</div>
                      <div style={styles.statValue}>{(trendData.market_pulse.confidence_score * 100).toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )}

              {/* Trending Themes */}
              {trendData.trending_themes && trendData.trending_themes.length > 0 && (
                <div style={styles.trendSection}>
                  <h4 style={styles.sectionTitle}>📈 Trending Themes ({trendData.trending_themes.length})</h4>
                  {trendData.trending_themes.map((theme, idx) => (
                    <div key={idx} style={styles.themeCard}>
                      <div style={styles.themeHeader}>
                        <h5 style={styles.themeName}>{theme.theme}</h5>
                        {theme.volume_percentage && (
                          <span style={styles.volumeBadge}>{theme.volume_percentage}%</span>
                        )}
                      </div>
                      <p style={styles.themeDesc}>{theme.description}</p>
                      {theme.sentiment && (
                        <div style={{
                          ...styles.sentimentBadge,
                          ...(theme.sentiment === 'positive' ? styles.sentimentPositive :
                              theme.sentiment === 'negative' ? styles.sentimentNegative :
                              styles.sentimentNeutral)
                        }}>
                          {theme.sentiment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        if (isLocationOutput) {
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>📍 Location Trend Analysis</h3>
              
              {/* Trend Pulse Stats */}
              {trendData.trend_pulse && (
                <div style={styles.trendStats}>
                  {trendData.trend_pulse.trends_analyzed && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Trends Analyzed</div>
                      <div style={styles.statValue}>{trendData.trend_pulse.trends_analyzed}</div>
                    </div>
                  )}
                  {trendData.trend_pulse.overall_mood && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Overall Mood</div>
                      <div style={styles.statValue}>{trendData.trend_pulse.overall_mood}</div>
                    </div>
                  )}
                  {trendData.trend_pulse.confidence_score && (
                    <div style={styles.statItem}>
                      <div style={styles.statLabel}>Confidence</div>
                      <div style={styles.statValue}>{(trendData.trend_pulse.confidence_score * 100).toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )}

              {/* Top Trends */}
              {trendData.top_trends_analysis && trendData.top_trends_analysis.length > 0 && (
                <div style={styles.trendSection}>
                  <h4 style={styles.sectionTitle}>🔥 Top Trends ({trendData.top_trends_analysis.length})</h4>
                  {trendData.top_trends_analysis.map((trend, idx) => (
                    <div key={idx} style={styles.themeCard}>
                      <div style={styles.themeHeader}>
                        <h5 style={styles.themeName}>{trend.trend_topic}</h5>
                        {trend.relevance_score !== undefined && (
                          <span style={styles.volumeBadge}>{(trend.relevance_score * 10).toFixed(1)}/10</span>
                        )}
                      </div>
                      <p style={styles.themeDesc}>{trend.why_trending}</p>
                      {trend.sentiment && (
                        <div style={{
                          ...styles.sentimentBadge,
                          ...(trend.sentiment === 'positive' ? styles.sentimentPositive :
                              trend.sentiment === 'negative' ? styles.sentimentNegative :
                              styles.sentimentNeutral)
                        }}>
                          {trend.sentiment}
                        </div>
                      )}
                      {trend.business_opportunity && (
                        <div style={styles.actionBox}>
                          <strong>💼 Business Opportunity:</strong> {trend.business_opportunity}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
      }

      // ClipGen - Viral Clip Generator
      if (agent_name === 'ClipGen') {
        const clipData = Array.isArray(output_data) ? output_data[0]?.output : output_data.output || output_data;
        console.log('ClipGen artifact data:', { 
          raw: output_data, 
          extracted: clipData,
          hasMetadata: !!clipData?.metadata,
          hasClips: !!clipData?.clips,
          clipCount: clipData?.clips?.length || 0
        });
        
        if (clipData) {
          return (
            <div style={styles.formattedOutput}>
              <h3 style={styles.outputTitle}>🎬 ClipGen - Viral Clips</h3>
              
              {/* Metadata */}
              {clipData.metadata && (
                <div style={styles.clipgenMetadata}>
                  <div style={styles.metadataGrid}>
                    <div style={styles.metadataItem}>
                      <span style={styles.metadataLabel}>Source</span>
                      <span style={styles.metadataValue}>{clipData.metadata.source_title || 'N/A'}</span>
                    </div>
                    <div style={styles.metadataItem}>
                      <span style={styles.metadataLabel}>Duration</span>
                      <span style={styles.metadataValue}>
                        {clipData.metadata.source_duration_sec 
                          ? `${Math.floor(clipData.metadata.source_duration_sec / 60)}:${(clipData.metadata.source_duration_sec % 60).toFixed(0).padStart(2, '0')}` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.metadataItem}>
                      <span style={styles.metadataLabel}>Clips Generated</span>
                      <span style={{...styles.metadataValue, color: '#8b5cf6'}}>{clipData.metadata.clips_generated || 0}</span>
                    </div>
                    <div style={styles.metadataItem}>
                      <span style={styles.metadataLabel}>Total Virality</span>
                      <span style={{...styles.metadataValue, color: '#ec4899'}}>{clipData.metadata.total_virality_score || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Clips */}
              {clipData.clips && clipData.clips.length > 0 ? (
                <div style={styles.clipsGrid}>
                  {clipData.clips.map((clip, idx) => {
                    const viralityColor = clip.virality_score >= 80 ? '#10b981' : 
                                         clip.virality_score >= 60 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={idx} style={styles.clipCard}>
                        {/* Clip Header */}
                        <div style={styles.clipHeader}>
                          <div style={styles.clipRankSection}>
                            <span style={{...styles.rankBadge, background: 'linear-gradient(135deg, #8b5cf6, #ec4899)'}}>
                              #{clip.rank}
                            </span>
                            <span style={styles.clipId}>Clip {clip.clip_id}</span>
                          </div>
                          <div style={{
                            ...styles.viralityBadge,
                            backgroundColor: `${viralityColor}20`,
                            color: viralityColor,
                            borderColor: viralityColor
                          }}>
                            🔥 {clip.virality_score}/100
                          </div>
                        </div>

                        {/* Timestamps */}
                        {clip.timestamps && (
                          <div style={styles.clipTimestamps}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span>
                              {clip.timestamps.start}s - {clip.timestamps.end}s 
                              <span style={styles.clipDuration}> ({clip.timestamps.duration_sec}s)</span>
                            </span>
                          </div>
                        )}

                        {/* Transcript */}
                        {clip.transcript && (
                          <div style={styles.clipTranscript}>
                            <strong style={styles.clipTranscriptLabel}>📝 Transcript:</strong>
                            <p style={styles.clipTranscriptText}>"{clip.transcript}"</p>
                          </div>
                        )}

                        {/* Caption */}
                        {clip.caption && (
                          <div style={styles.clipCaption}>
                            <strong style={styles.clipCaptionLabel}>💬 Caption:</strong>
                            <p style={styles.clipCaptionText}>{clip.caption}</p>
                          </div>
                        )}

                        {/* Platforms */}
                        {clip.platforms && clip.platforms.length > 0 && (
                          <div style={styles.clipPlatforms}>
                            <strong style={styles.platformsLabel}>📱 Best for:</strong>
                            <div style={styles.platformTags}>
                              {clip.platforms.map((platform, pidx) => {
                                const isBest = platform === clip.best_platform;
                                const platformColors = {
                                  'TikTok': '#00f2ea',
                                  'Instagram Reels': '#e4405f',
                                  'Instagram': '#e4405f',
                                  'YouTube Shorts': '#ff0000',
                                  'YouTube': '#ff0000',
                                  'LinkedIn': '#0077b5'
                                };
                                const color = platformColors[platform] || '#6366f1';
                                return (
                                  <span 
                                    key={pidx}
                                    style={{
                                      ...styles.platformTag,
                                      ...(isBest ? {
                                        borderColor: color,
                                        color: color,
                                        fontWeight: '600'
                                      } : {})
                                    }}
                                  >
                                    {platform}{isBest && ' ⭐'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={styles.noData}>No clips were generated</p>
              )}

              {/* Strategy */}
              {clipData.strategy && (
                <div style={styles.clipgenStrategy}>
                  <h4 style={styles.strategyTitle}>📅 Content Strategy</h4>
                  
                  {clipData.strategy.hashtags && clipData.strategy.hashtags.length > 0 && (
                    <div style={styles.strategySection}>
                      <strong>Hashtags:</strong>
                      <div style={styles.hashtagsContainer}>
                        {clipData.strategy.hashtags.map((tag, idx) => (
                          <span key={idx} style={styles.hashtag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {clipData.strategy.posting_schedule && clipData.strategy.posting_schedule.length > 0 && (
                    <div style={styles.strategySection}>
                      <strong>Posting Schedule:</strong>
                      <div style={styles.scheduleGrid}>
                        {clipData.strategy.posting_schedule.map((schedule, idx) => (
                          <div key={idx} style={styles.scheduleItem}>
                            <span style={styles.scheduleClip}>Clip {schedule.clip_id}</span>
                            <span style={styles.scheduleDay}>{schedule.day}</span>
                            <span style={styles.scheduleTime}>{schedule.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {clipData.notes && (
                <div style={styles.clipgenNotes}>
                  <strong>💡 Notes:</strong>
                  <p>{clipData.notes}</p>
                </div>
              )}
            </div>
          );
        }
      }

      // Fallback - show formatted JSON for unknown formats
      console.warn(`No rendering case for agent: ${agent_name}, showing raw data`);
      return (
        <div style={styles.formattedOutput}>
          <h3 style={styles.outputTitle}>⚠️ Raw Output (No Formatter Available)</h3>
          <p style={styles.fallbackNote}>This agent doesn't have a custom formatter yet. Showing raw data:</p>
          <div style={styles.artifactData}>
            <pre style={styles.artifactDataPre}>
              {JSON.stringify(output_data, null, 2)}
            </pre>
          </div>
        </div>
      );
    } catch (error) {
      console.error(`Error rendering ${agent_name} artifact:`, error, output_data);
      return (
        <div style={styles.formattedOutput}>
          <h3 style={styles.outputTitle}>❌ Error Displaying Output</h3>
          <p style={styles.errorNote}>An error occurred while formatting the output. Raw data:</p>
          <div style={styles.artifactData}>
            <pre style={styles.artifactDataPre}>
              {JSON.stringify(output_data, null, 2)}
            </pre>
          </div>
        </div>
      );
    }
  };

  useEffect(() => {
    loadCampaign();
    loadAgents();
  }, [campaignId]);

  const loadCampaign = async () => {
    setLoading(true);
    const result = await getCampaignById(campaignId);
    if (result.success) {
      setCampaign(result.campaign);
    } else {
      alert('Failed to load campaign');
      navigate('/campaigns');
    }
    setLoading(false);
  };

  const loadAgents = async () => {
    const result = await getAllAgents();
    if (result.success) {
      setAllAgents(result.agents);
    }
  };

  const handleStatusChange = async (newStatus) => {
    const result = await updateCampaign(campaignId, { status: newStatus });
    if (result.success) {
      loadCampaign();
    }
  };

  const handleAddAgent = async (agentId) => {
    const result = await addAgentToCampaign(campaignId, agentId);
    if (result.success) {
      setShowAddAgent(false);
      loadCampaign();
    }
  };

  const handleRemoveAgent = async (agentId) => {
    if (!confirm('Remove this agent from the campaign?')) return;
    
    const result = await removeAgentFromCampaign(campaignId, agentId);
    if (result.success) {
      loadCampaign();
    }
  };

  const handleRunAgent = (task) => {
    // Navigate to the specific agent page with campaign context
    const agentName = task.agent.name;
    const agentRoutes = {
      'TrendIQ': '/trendiq',
      'SEOrix': '/seorix',
      'AdVisor': '/advisor',
      'EchoMind': '/echomind',
      'SociaPlan': '/sociaplan',
      'WhatsPulse': '/whatspulse',
      'LeadGen': '/leadgen',
      'Scriptly': '/scriptly',
      'Adbrief': '/adbrief'
    };
    
    const route = agentRoutes[agentName];
    if (route) {
      // Pass campaign ID via state
      navigate(route, { state: { campaignId } });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#10b981';
      case 'Paused': return '#f59e0b';
      case 'Completed': return '#6366f1';
      default: return '#64748b';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const availableAgents = allAgents.filter(
    agent => !campaign?.tasks.some(task => task.agent_id === agent.id)
  );

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const progress = campaign.progress || { total_tasks: 0, completed_tasks: 0, progress_percentage: 0 };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/campaigns')}>
          <ArrowLeft size={20} />
          Back to Campaigns
        </button>

        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>{campaign.name}</h1>
            {campaign.description && (
              <p style={styles.description}>{campaign.description}</p>
            )}
          </div>

          <div style={styles.headerRight}>
            <div style={styles.statusDropdown}>
              <button
                style={{
                  ...styles.statusButton,
                  borderColor: getStatusColor(campaign.status)
                }}
              >
                <span style={{
                  ...styles.statusDot,
                  backgroundColor: getStatusColor(campaign.status)
                }} />
                {campaign.status}
                <ChevronDown size={16} />
              </button>
              <div style={styles.statusMenu}>
                <button
                  style={styles.statusOption}
                  onClick={() => handleStatusChange('Active')}
                >
                  <Play size={16} />
                  Active
                </button>
                <button
                  style={styles.statusOption}
                  onClick={() => handleStatusChange('Paused')}
                >
                  <Pause size={16} />
                  Paused
                </button>
                <button
                  style={styles.statusOption}
                  onClick={() => handleStatusChange('Completed')}
                >
                  <CheckCircle size={16} />
                  Completed
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>Campaign Progress</span>
            <span style={styles.progressStats}>
              {progress.completed_tasks} / {progress.total_tasks} Tasks Complete
            </span>
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progress.progress_percentage || 0}%`
              }}
            />
          </div>
          <div style={styles.progressPercentage}>
            {Math.round(progress.progress_percentage || 0)}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'tasks' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckCircle size={20} />
          Task List ({campaign.tasks.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'artifacts' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('artifacts')}
        >
          <FileText size={20} />
          Campaign Artifacts ({campaign.artifacts.length})
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'tasks' ? (
          <div style={styles.tasksSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Agents & Tasks</h2>
              <button
                style={styles.addButton}
                onClick={() => setShowAddAgent(!showAddAgent)}
              >
                <Plus size={18} />
                Add Agent
              </button>
            </div>

            {showAddAgent && availableAgents.length > 0 && (
              <div style={styles.addAgentPanel}>
                <h3 style={styles.addAgentTitle}>Select an agent to add:</h3>
                <div style={styles.agentGrid}>
                  {availableAgents.map((agent) => (
                    <div
                      key={agent.id}
                      style={styles.agentOption}
                      onClick={() => handleAddAgent(agent.id)}
                    >
                      <div style={styles.agentOptionName}>{agent.name}</div>
                      <div style={styles.agentOptionDescription}>
                        {agent.description || 'No description'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {campaign.tasks.length === 0 ? (
              <div style={styles.emptyState}>
                <CheckCircle size={64} style={styles.emptyIcon} />
                <h3 style={styles.emptyTitle}>No tasks yet</h3>
                <p style={styles.emptyText}>
                  Add agents to this campaign to create your task list
                </p>
              </div>
            ) : (
              <div style={styles.tasksList}>
                {campaign.tasks.map((task, index) => (
                  <div key={task.id} style={styles.taskCard}>
                    <div style={styles.taskNumber}>{index + 1}</div>
                    
                    <div style={styles.taskIcon}>
                      {task.is_complete ? (
                        <CheckCircle size={32} style={{ color: '#10b981' }} />
                      ) : (
                        <Circle size={32} style={{ color: '#64748b' }} />
                      )}
                    </div>

                    <div style={styles.taskInfo}>
                      <div style={styles.taskName}>
                        {task.agent.name}
                        {/* Show artifact count if any artifacts exist for this agent */}
                        {(() => {
                          const artifactCount = campaign.artifacts.filter(
                            artifact => artifact.agent_name === task.agent.name
                          ).length;
                          return artifactCount > 0 ? (
                            <span style={styles.artifactCountBadge}>
                              {artifactCount} {artifactCount === 1 ? 'output' : 'outputs'}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div style={styles.taskDescription}>
                        {task.agent.description || 'AI Agent'}
                      </div>
                      {task.completed_at && (
                        <div style={styles.taskCompletedDate}>
                          <Calendar size={14} />
                          Completed {formatDate(task.completed_at)}
                        </div>
                      )}
                    </div>

                    <div style={styles.taskActions}>
                      <button
                        style={{
                          ...styles.runButton,
                          ...(task.is_complete ? styles.runButtonComplete : {})
                        }}
                        onClick={() => handleRunAgent(task)}
                        title={task.is_complete ? 'Run this agent again to create another artifact' : 'Run this agent for the first time'}
                      >
                        <Play size={16} />
                        {task.is_complete ? 'Run Again' : "Let's Go"}
                      </button>
                      <button
                        style={styles.removeButton}
                        onClick={() => handleRemoveAgent(task.agent_id)}
                        title="Remove this agent from campaign"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.artifactsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Generated Artifacts</h2>
              <p style={styles.sectionSubtitle}>
                All outputs created by agents in this campaign
              </p>
            </div>

            {campaign.artifacts.length === 0 ? (
              <div style={styles.emptyState}>
                <FileText size={64} style={styles.emptyIcon} />
                <h3 style={styles.emptyTitle}>No artifacts yet</h3>
                <p style={styles.emptyText}>
                  Run agents in this campaign to generate artifacts
                </p>
              </div>
            ) : (
              <div style={styles.artifactsList}>
                {campaign.artifacts.map((artifact) => (
                  <div key={artifact.id} style={styles.artifactCard}>
                    <div style={styles.artifactHeader}>
                      <div style={styles.artifactIcon}>
                        <FileText size={24} />
                      </div>
                      <div style={styles.artifactInfo}>
                        <div style={styles.artifactName}>
                          {artifact.agent_name} Output
                        </div>
                        <div style={styles.artifactDate}>
                          <Calendar size={14} />
                          {formatDate(artifact.created_at)}
                        </div>
                      </div>
                      <button
                        style={styles.expandButton}
                        onClick={() => setExpandedArtifact(
                          expandedArtifact === artifact.id ? null : artifact.id
                        )}
                      >
                        {expandedArtifact === artifact.id ? 'Hide' : 'View'}
                      </button>
                    </div>

                    {artifact.output_summary && (
                      <div style={styles.artifactSummary}>
                        {artifact.output_summary}
                      </div>
                    )}

                    {expandedArtifact === artifact.id && artifact.output_data && (
                      renderArtifactOutput(artifact)
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #16001e 100%)',
    color: 'white',
    paddingBottom: '40px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(147, 51, 234, 0.2)',
    borderTopColor: '#9333ea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#94a3b8',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '24px 32px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'all 0.2s ease',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  description: {
    fontSize: '16px',
    color: '#94a3b8',
    lineHeight: '1.6',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
  },
  statusDropdown: {
    position: 'relative',
  },
  statusButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '8px',
    minWidth: '160px',
    display: 'none',
    zIndex: 100,
  },
  statusOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  progressSection: {
    marginTop: '24px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  progressLabel: {
    fontSize: '14px',
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  progressStats: {
    fontSize: '14px',
    color: '#64748b',
  },
  progressBar: {
    width: '100%',
    height: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #9333ea 0%, #ec4899 100%)',
    borderRadius: '6px',
    transition: 'width 0.5s ease',
  },
  progressPercentage: {
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textAlign: 'right',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    padding: '16px 32px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: '#94a3b8',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'rgba(147, 51, 234, 0.1)',
    color: '#9333ea',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px',
  },
  sectionHeader: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'white',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  addAgentPanel: {
    background: 'rgba(147, 51, 234, 0.05)',
    border: '1px solid rgba(147, 51, 234, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  },
  addAgentTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '16px',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  agentOption: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  agentOptionName: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '4px',
  },
  agentOptionDescription: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  taskCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    transition: 'all 0.2s ease',
  },
  taskNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(147, 51, 234, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '700',
    color: '#9333ea',
  },
  taskIcon: {
    flexShrink: 0,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: '20px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  artifactCountBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  taskDescription: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  taskCompletedDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#10b981',
  },
  taskActions: {
    display: 'flex',
    gap: '8px',
  },
  runButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  runButtonComplete: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    opacity: 0.9,
  },
  removeButton: {
    padding: '10px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  artifactsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  artifactCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '24px',
  },
  artifactHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  artifactIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(147, 51, 234, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9333ea',
  },
  artifactInfo: {
    flex: 1,
  },
  artifactName: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '4px',
  },
  artifactDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#94a3b8',
  },
  expandButton: {
    padding: '8px 16px',
    background: 'rgba(147, 51, 234, 0.1)',
    border: '1px solid rgba(147, 51, 234, 0.2)',
    borderRadius: '8px',
    color: '#9333ea',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  artifactSummary: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  artifactData: {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  artifactDataPre: {
    margin: 0,
    fontSize: '13px',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    color: '#64748b',
    marginBottom: '24px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#94a3b8',
  },
  // Formatted output styles
  formattedOutput: {
    marginTop: '16px',
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    maxHeight: '600px',
    overflow: 'auto',
  },
  outputTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid rgba(147, 51, 234, 0.3)',
  },
  outputMeta: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  recommendationSection: {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  priorityTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  recommendationList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  recommendationItem: {
    padding: '12px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: '1.6',
  },
  leadCard: {
    marginBottom: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
  },
  leadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
  },
  leadDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    color: '#94a3b8',
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
  },
  calendarBrand: {
    marginBottom: '20px',
    padding: '16px',
    background: 'rgba(147, 51, 234, 0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  socialPost: {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
  },
  dayTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#9333ea',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  analysisSection: {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  broadcastStats: {
    padding: '16px',
    background: 'rgba(147, 51, 234, 0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  adImage: {
    width: '100%',
    maxWidth: '600px',
    height: 'auto',
    borderRadius: '10px',
    marginBottom: '16px',
    border: '2px solid rgba(147, 51, 234, 0.3)',
  },
  adDetails: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  scriptVariation: {
    marginBottom: '24px',
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
    borderRadius: '16px',
    border: '2px solid rgba(102, 126, 234, 0.3)',
  },
  scriptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
  },
  variationTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#a78bfa',
    margin: 0,
  },
  retentionBadge: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  scriptMeta: {
    marginBottom: '16px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  scriptContent: {
    marginBottom: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    border: '2px solid rgba(102, 126, 234, 0.3)',
  },
  scriptText: {
    marginTop: '8px',
    lineHeight: '1.8',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    fontSize: '14px',
  },
  sceneBreakdown: {
    marginBottom: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
  },
  sceneItem: {
    marginTop: '12px',
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    borderLeft: '4px solid #764ba2',
  },
  sceneTimestamp: {
    fontWeight: '700',
    color: '#a78bfa',
    marginBottom: '8px',
    fontSize: '14px',
  },
  sceneDetail: {
    marginBottom: '6px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
  sceneNote: {
    marginTop: '8px',
    paddingLeft: '12px',
    borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
    fontStyle: 'italic',
    color: '#94a3b8',
    fontSize: '13px',
  },
  whyWorks: {
    padding: '14px',
    background: 'rgba(102, 126, 234, 0.15)',
    borderRadius: '10px',
    borderLeft: '4px solid #667eea',
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: '1.6',
  },
  // Adbrief styles
  briefMeta: {
    padding: '16px',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '12px',
    marginBottom: '20px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  briefVariation: {
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
  },
  briefHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  briefTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#e2e8f0',
  },
  briefAngle: {
    color: '#a78bfa',
    fontWeight: '600',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  briefContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  briefSection: {
    marginBottom: '12px',
  },
  briefHeadline: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#e2e8f0',
    lineHeight: '1.4',
    margin: '8px 0',
  },
  keyPointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '8px',
  },
  keyPoint: {
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '14px',
    lineHeight: '1.5',
    borderLeft: '3px solid #ec4899',
  },
  ctaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '18px',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(245, 158, 11, 0.2)',
  },
  buttonPreview: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'default',
    alignSelf: 'flex-start',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
  },
  // TrendIQ specific styles
  trendHighlight: {
    padding: '24px',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    marginBottom: '24px',
  },
  trendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  trendTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#e2e8f0',
    margin: 0,
  },
  urgencyBadge: {
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '700',
    border: '1px solid',
  },
  urgencyHigh: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    borderColor: '#ef4444',
  },
  urgencyMedium: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fcd34d',
    borderColor: '#f59e0b',
  },
  urgencyLow: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#6ee7b7',
    borderColor: '#10b981',
  },
  summaryHeadline: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: '1.4',
    marginBottom: '12px',
  },
  summaryText: {
    fontSize: '15px',
    color: '#cbd5e1',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  actionBox: {
    padding: '14px 18px',
    background: 'rgba(16, 185, 129, 0.15)',
    borderRadius: '10px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#6ee7b7',
    fontSize: '14px',
    lineHeight: '1.5',
    marginTop: '12px',
  },
  trendStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statItem: {
    padding: '18px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '8px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#8b5cf6',
  },
  trendSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: '16px',
  },
  themeCard: {
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    marginBottom: '16px',
  },
  themeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '12px',
  },
  themeName: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
    flex: 1,
  },
  volumeBadge: {
    padding: '6px 12px',
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#c4b5fd',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid rgba(139, 92, 246, 0.4)',
  },
  themeDesc: {
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  sentimentBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '700',
    marginTop: '8px',
  },
  sentimentPositive: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#6ee7b7',
    border: '1px solid rgba(16, 185, 129, 0.4)',
  },
  sentimentNegative: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.4)',
  },
  sentimentNeutral: {
    background: 'rgba(148, 163, 184, 0.2)',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.4)',
  },
  // Image placeholder styles
  imagePlaceholder: {
    width: '100%',
    maxWidth: '600px',
    height: '300px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px dashed rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  placeholderIcon: {
    fontSize: '48px',
    opacity: 0.6,
  },
  placeholderText: {
    fontSize: '14px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  // Error and fallback styles
  noData: {
    padding: '24px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    textAlign: 'center',
    fontSize: '14px',
  },
  fallbackNote: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '16px',
    padding: '12px',
    background: 'rgba(251, 191, 36, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(251, 191, 36, 0.3)',
  },
  errorNote: {
    fontSize: '14px',
    color: '#fca5a5',
    marginBottom: '16px',
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  // ClipGen specific styles
  clipgenMetadata: {
    padding: '20px',
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    marginBottom: '20px',
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  metadataItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metadataLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metadataValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  clipsGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '20px',
  },
  clipCard: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '12px',
    padding: '18px',
  },
  clipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingBottom: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  clipRankSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  rankBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '13px',
    color: 'white',
  },
  clipId: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  viralityBadge: {
    padding: '6px 12px',
    borderRadius: '16px',
    fontWeight: '600',
    fontSize: '13px',
    border: '2px solid',
  },
  clipTimestamps: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px',
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '8px',
    marginBottom: '12px',
    color: '#e2e8f0',
    fontSize: '14px',
  },
  clipDuration: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: '6px',
  },
  clipTranscript: {
    marginBottom: '12px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    borderLeft: '3px solid #8b5cf6',
  },
  clipTranscriptLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'block',
    marginBottom: '6px',
  },
  clipTranscriptText: {
    color: '#cbd5e1',
    lineHeight: '1.6',
    fontStyle: 'italic',
    margin: 0,
  },
  clipCaption: {
    marginBottom: '12px',
    padding: '12px',
    background: 'rgba(236, 72, 153, 0.1)',
    borderRadius: '8px',
    borderLeft: '3px solid #ec4899',
  },
  clipCaptionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'block',
    marginBottom: '6px',
  },
  clipCaptionText: {
    color: '#cbd5e1',
    lineHeight: '1.6',
    margin: 0,
  },
  clipPlatforms: {
    marginTop: '12px',
  },
  platformsLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'block',
    marginBottom: '8px',
  },
  platformTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  platformTag: {
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '16px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  clipgenStrategy: {
    padding: '20px',
    background: 'rgba(236, 72, 153, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    marginBottom: '16px',
  },
  strategyTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: '16px',
  },
  strategySection: {
    marginBottom: '16px',
  },
  hashtagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  hashtag: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))',
    border: '1px solid rgba(139, 92, 246, 0.5)',
    borderRadius: '16px',
    color: 'white',
    fontWeight: '500',
    fontSize: '13px',
  },
  scheduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '8px',
  },
  scheduleItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(236, 72, 153, 0.3)',
    borderRadius: '10px',
  },
  scheduleClip: {
    fontSize: '13px',
    color: '#ec4899',
    fontWeight: '600',
  },
  scheduleDay: {
    fontSize: '14px',
    color: 'white',
    fontWeight: '600',
  },
  scheduleTime: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  clipgenNotes: {
    padding: '16px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
};

export default CampaignDetailPage;
