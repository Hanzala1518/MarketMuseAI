import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, TrendingUp, MapPin, Search, Globe, Loader2, AlertCircle, CheckCircle, BarChart3, Activity, Zap, Sparkles, Target, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { executeWithTokens } from './utils/tokenService';
import { handleCampaignTaskCompletion } from './services/campaignService';

function TrendIQPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = location.state?.campaignId;
  const progressIntervalRef = useRef(null);
  const [session, setSession] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('keyword'); // 'keyword' or 'location'
  const [keyword, setKeyword] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);
  const [citySearch, setCitySearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [result, setResult] = useState(null);
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

  // Fetch cities from Gist
  useEffect(() => {
    fetchCities();
  }, []);

  // Filter cities based on search
  useEffect(() => {
    if (citySearch.trim() === '') {
      setFilteredCities(cities);
    } else {
      const filtered = cities.filter(city =>
        city.name.toLowerCase().includes(citySearch.toLowerCase())
      );
      setFilteredCities(filtered);
    }
  }, [citySearch, cities]);

  const fetchCities = async () => {
    try {
      const response = await fetch(
        'https://gist.githubusercontent.com/tedyblood/5bb5a9f78314cc1f478b3dd7cde790b9/raw/af7ce162491641c250b69c439957c2bab8fe8ef9/Woeid'
      );
      const data = await response.json();
      
      // Filter to get only Town entries (placeType.code === 7) and format them
      const parsedCities = data
        .filter(place => place.placeType?.code === 7 && place.name && place.woeid)
        .map(place => ({
          name: `${place.name}, ${place.country}`,
          woeid: place.woeid,
          countryCode: place.countryCode,
          displayName: place.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('Parsed cities:', parsedCities.length);
      setCities(parsedCities);
    } catch (err) {
      console.error('Error fetching cities:', err);
      setError('Failed to load cities list');
    }
  };

  const handleUseMyLocation = async () => {
    setError('');
    
    if (cities.length === 0) {
      setError('Cities are still loading. Please wait a moment.');
      return;
    }
    
    // Try multiple detection methods
    try {
      // Method 1: Try timezone detection first (faster)
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('User timezone:', timezone);
      
      // Extract country/city from timezone (e.g., "America/New_York" -> "New York")
      const parts = timezone.split('/');
      if (parts.length >= 2) {
        const cityGuess = parts[parts.length - 1].replace(/_/g, ' ');
        console.log('Guessed city from timezone:', cityGuess);
        
        // Try exact match first
        let matchingCity = cities.find(city => 
          city.displayName.toLowerCase() === cityGuess.toLowerCase()
        );
        
        // Try partial match
        if (!matchingCity) {
          matchingCity = cities.find(city => 
            city.displayName.toLowerCase().includes(cityGuess.toLowerCase()) ||
            city.name.toLowerCase().includes(cityGuess.toLowerCase())
          );
        }
        
        if (matchingCity) {
          setSelectedCity(matchingCity.name);
          setCitySearch(matchingCity.name);
          setShowDropdown(false);
          console.log('✅ Matched city from timezone:', matchingCity.name);
          return;
        }
      }
      
      // Method 2: If timezone didn't work, try geolocation API with reverse geocoding
      if (navigator.geolocation) {
        console.log('Trying geolocation API with reverse geocoding...');
        setError('Detecting your location...');
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('User coordinates:', latitude, longitude);
            
            try {
              // Use OpenStreetMap's Nominatim API for reverse geocoding (free, no API key needed)
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
                {
                  headers: {
                    'User-Agent': 'MarketMuse-TrendIQ/1.0'
                  }
                }
              );
              
              if (!response.ok) {
                throw new Error('Reverse geocoding failed');
              }
              
              const data = await response.json();
              console.log('Reverse geocoding result:', data);
              
              // Extract city name from the response
              const detectedCity = data.address.city || 
                                   data.address.town || 
                                   data.address.village || 
                                   data.address.county ||
                                   data.address.state;
              
              if (detectedCity) {
                console.log('Detected city from coordinates:', detectedCity);
                
                // Try to find matching city in our list
                let matchingCity = cities.find(city => 
                  city.displayName.toLowerCase() === detectedCity.toLowerCase()
                );
                
                // Try partial match
                if (!matchingCity) {
                  matchingCity = cities.find(city => 
                    city.displayName.toLowerCase().includes(detectedCity.toLowerCase()) ||
                    detectedCity.toLowerCase().includes(city.displayName.toLowerCase())
                  );
                }
                
                // Also try matching with the country
                if (!matchingCity && data.address.country) {
                  const searchTerm = `${detectedCity}, ${data.address.country}`;
                  matchingCity = cities.find(city => 
                    city.name.toLowerCase().includes(detectedCity.toLowerCase())
                  );
                }
                
                if (matchingCity) {
                  setSelectedCity(matchingCity.name);
                  setCitySearch(matchingCity.name);
                  setShowDropdown(false);
                  setError('');
                  console.log('✅ Matched city from geolocation:', matchingCity.name);
                } else {
                  // If we can't find exact match, show the detected city in search
                  setCitySearch(detectedCity);
                  setShowDropdown(true);
                  setError(`Detected: ${detectedCity}. Please select from dropdown if it appears.`);
                }
              } else {
                setError('Could not determine city from your location. Please select manually.');
              }
            } catch (geoError) {
              console.error('Reverse geocoding error:', geoError);
              setError(`Location detected (${latitude.toFixed(2)}, ${longitude.toFixed(2)}), but could not determine city. Please select manually.`);
            }
          },
          (geoError) => {
            console.error('Geolocation error:', geoError);
            setError('Location access denied or unavailable. Please select your city from the dropdown.');
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        setError('Geolocation not supported by your browser. Please select your city manually.');
      }
    } catch (error) {
      console.error('Location detection error:', error);
      setError('Failed to detect location. Please select a city manually from the dropdown.');
    }
  };

  const handleSubmit = async () => {
    if (!session || !session.user) {
      setError('Please log in to use TrendIQ');
      navigate('/login');
      return;
    }

    // Validation
    if (analysisMode === 'keyword' && !keyword.trim()) {
      setError('Please enter a keyword');
      return;
    }
    if (analysisMode === 'location' && !selectedCity) {
      setError('Please select a city');
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setError('');
    setResult(null);

    // Simulate gradual progress
    progressIntervalRef.current = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          return 90; // Stop at 90% until actual response
        }
        return prev + Math.random() * 15; // Random increments
      });
    }, 500);

    try {
      console.log('🚀 Starting TrendIQ with token deduction...');
      
      // Determine token cost based on mode
      const tokenCost = analysisMode === 'keyword' ? 250 : 150;
      console.log(`💰 Token cost for ${analysisMode} mode: ${tokenCost}`);
      
      // Execute with token deduction
      const tokenResult = await executeWithTokens(
        session.user.id,
        'TrendIQ',
        async () => {
          // Build request body based on mode
          let requestBody;
          if (analysisMode === 'keyword') {
            requestBody = {
              trend: false,
              keyword: keyword.trim(),
              city: 'none',
              Type: 'Top'
            };
          } else {
            // Extract just the city name from "City, Country" format
            const cityName = selectedCity.split(',')[0].trim();
            requestBody = {
              trend: true,
              city: cityName,
              keyword: 'none',
              Type: 'none'
            };
          }

          console.log('Request body:', requestBody);

          // Add timeout to fetch request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

          try {
            const response = await fetch(
              'https://glowing-g79w8.crab.containers.automata.host/webhook/trendiq',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
              }
            );

            clearTimeout(timeoutId);

            console.log('Response status:', response.status, response.statusText);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
              throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();
            console.log('Raw response length:', text.length);
            console.log('Raw response preview:', text.substring(0, 500));
            console.log('Raw response full:', text);
            
            // Check if response is empty
            if (!text || text.trim() === '') {
              console.error('Empty response received!');
              console.error('Request was:', requestBody);
              console.error('Response headers were:', Object.fromEntries(response.headers.entries()));
              throw new Error('The TrendIQ webhook returned no data. This might mean:\n\n1. The webhook is still processing (keyword analysis takes 30-60 seconds)\n2. There may be an issue with the n8n workflow\n3. Try with a different keyword or check the n8n workflow status\n\nPlease wait a moment and try again.');
            }
            
            // Try to parse JSON
            let data;
            try {
              data = JSON.parse(text);
              console.log('Parsed data type:', typeof data, Array.isArray(data));
              
              // Handle array response (both modes can return array with output property)
              if (Array.isArray(data) && data.length > 0 && data[0].output) {
                data = data[0].output;
                console.log('Extracted from array wrapper');
              }
              
              // Validate that we have data
              if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
                throw new Error('API returned empty data object. The analysis may not have completed. Please try again.');
              }
              
              console.log('Final parsed data keys:', Object.keys(data));
            } catch (e) {
              console.error('JSON parse error:', e);
              console.error('Failed text:', text.substring(0, 500));
              throw new Error('Invalid response format from API. The analysis may still be processing. Please try again in a moment.');
            }

            return data;
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error('Request timed out after 2 minutes. The analysis is taking longer than expected. Please try again or use a simpler keyword.');
            }
            throw fetchError;
          }
        },
        { keyword: keyword || selectedCity, mode: analysisMode }, // Request data
        tokenCost, // Token multiplier based on mode
        analysisMode === 'keyword' 
          ? `Keyword Analysis: ${keyword}`
          : `Location Trends: ${selectedCity}`, // Output summary
        campaignId // Campaign ID (if part of campaign)
      );

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // Complete the progress bar to 100% and turn green
      setLoadingProgress(100);
      
      // Wait a moment to show the completed green bar
      await new Promise(resolve => setTimeout(resolve, 800));

      // Check result
      if (!tokenResult.success) {
        setError(tokenResult.error);
        setLoading(false);
        return;
      }

      // Success - tokens deducted
      console.log(`✅ TrendIQ completed! Tokens deducted: ${tokenResult.tokensDeducted}`);
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
            .eq('name', 'TrendIQ')
            .single();
          
          if (agentError) {
            console.error('❌ Error fetching agent ID:', agentError);
          } else if (!agentData) {
            console.error('❌ TrendIQ agent not found in database');
          } else {
            const agentId = agentData.id;
            console.log('✅ Agent ID:', agentId);
            
            const outputSummary = analysisMode === 'keyword' 
              ? `Keyword Analysis: ${keyword}`
              : `Location Trends: ${selectedCity}`;
            
            const campaignResult = await handleCampaignTaskCompletion(
              campaignId,
              agentId,
              'TrendIQ',
              tokenResult.logId,
              tokenResult.data,
              outputSummary
            );
            
            if (campaignResult.success) {
              console.log('✅ Campaign artifact saved successfully!');
              alert('✅ Results saved to campaign! You can run this agent again to create additional artifacts.');
            } else {
              console.error('❌ Failed to save campaign artifact:', campaignResult.error);
              alert('⚠️ Analysis completed but failed to save to campaign: ' + campaignResult.error);
            }
          }
        }
      } else {
        console.log('📝 Running as standalone agent (not part of campaign)');
      }

    } catch (err) {
      console.error('❌ TrendIQ error:', err);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setError(err.message || 'Trend analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const renderOutput = () => {
    if (!result) return null;

    // Detect output type based on structure
    const isKeywordOutput = result.market_pulse && (result.trending_themes || result.executive_summary);
    const isLocationOutput = result.trend_pulse || result.top_trends_analysis;

    if (isKeywordOutput) {
      return (
        <div style={s.results}>
          {/* Header */}
          <div style={s.resultHeader}>
            <div>
              <div style={s.badge2}>✨ Analysis Complete</div>
              <h1 style={s.reportTitle}>Keyword Trend Analysis</h1>
              <p style={s.reportSubtitle}>
                Keyword: <strong>{result.market_pulse?.keyword || keyword}</strong>
                {result.market_pulse?.analysis_date && (
                  <> • {new Date(result.market_pulse.analysis_date).toLocaleString()}</>
                )}
              </p>
            </div>
            <button onClick={() => setResult(null)} style={s.newBtn}>
              <Search size={18} /> New Analysis
            </button>
          </div>

          {/* Executive Summary */}
          {result.executive_summary && (
            <div style={{...s.card, ...s.highlightCard}}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Sparkles size={24} /> Executive Summary</h2>
                {result.executive_summary.urgency_level && (
                  <span style={{
                    ...s.count,
                    ...(result.executive_summary.urgency_level === 'high' || result.executive_summary.urgency_level === 'critical' 
                      ? { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: '#ef4444' } 
                      : result.executive_summary.urgency_level === 'medium'
                      ? { background: 'rgba(251,191,36,0.2)', color: '#fcd34d' }
                      : {})
                  }}>
                    {result.executive_summary.urgency_level.toUpperCase()}
                  </span>
                )}
              </div>
              <h3 style={s.summaryHeadline}>{result.executive_summary.headline}</h3>
              <p style={s.summaryInsight}><strong>Key Insight:</strong> {result.executive_summary.key_insight}</p>
              {result.executive_summary.recommended_action && (
                <div style={s.actionBox}>
                  <strong>📋 Recommended Action:</strong> {result.executive_summary.recommended_action}
                </div>
              )}
            </div>
          )}

          {/* Market Pulse Stats */}
          {result.market_pulse && (
            <div style={s.statsGrid}>
              {result.market_pulse.data_points_analyzed && (
                <div style={s.statCard}>
                  <BarChart3 size={32} style={{ color: '#8b5cf6', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{result.market_pulse.data_points_analyzed}</div>
                  <div style={s.statLabel}>Data Points</div>
                </div>
              )}
              {result.market_pulse.overall_sentiment && (
                <div style={s.statCard}>
                  <Activity size={32} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{result.market_pulse.overall_sentiment}</div>
                  <div style={s.statLabel}>Overall Sentiment</div>
                </div>
              )}
              {result.market_pulse.confidence_score !== undefined && (
                <div style={s.statCard}>
                  <CheckCircle size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{(result.market_pulse.confidence_score * 100).toFixed(0)}%</div>
                  <div style={s.statLabel}>Confidence</div>
                </div>
              )}
            </div>
          )}

          {/* Trending Themes - ENHANCED */}
          {result.trending_themes && result.trending_themes.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><TrendingUp size={24} /> Trending Themes</h2>
                <span style={s.count}>{result.trending_themes.length} themes</span>
              </div>
              <div style={s.themesGrid}>
                {result.trending_themes.map((theme, idx) => (
                  <div key={idx} style={s.themeCard}>
                    <div style={s.themeHeader}>
                      <h3 style={s.themeTitle}>{theme.theme}</h3>
                      {theme.volume_percentage && (
                        <span style={s.volumeBadge}>{theme.volume_percentage}%</span>
                      )}
                    </div>
                    <p style={s.themeDesc}>{theme.description}</p>
                    
                    {/* Sentiment Badge */}
                    {theme.sentiment && (
                      <div style={{
                        ...s.sentimentBadge,
                        ...(theme.sentiment === 'positive' ? s.sentimentPositive :
                            theme.sentiment === 'negative' ? s.sentimentNegative :
                            s.sentimentNeutral),
                        marginBottom: '1rem'
                      }}>
                        {theme.sentiment}
                      </div>
                    )}

                    {/* Top Metrics */}
                    {theme.top_metrics && (
                      <div style={s.themeStats}>
                        {theme.top_metrics.avg_likes && (
                          <div style={s.themeStat}>
                            <span style={s.themeLabel}>Avg Likes</span>
                            <strong style={s.themeValue}>{theme.top_metrics.avg_likes.toLocaleString()}</strong>
                          </div>
                        )}
                        {theme.top_metrics.avg_retweets && (
                          <div style={s.themeStat}>
                            <span style={s.themeLabel}>Avg Retweets</span>
                            <strong style={s.themeValue}>{theme.top_metrics.avg_retweets.toLocaleString()}</strong>
                          </div>
                        )}
                        {theme.top_metrics.avg_views && (
                          <div style={s.themeStat}>
                            <span style={s.themeLabel}>Avg Views</span>
                            <strong style={s.themeValue}>{theme.top_metrics.avg_views.toLocaleString()}</strong>
                          </div>
                        )}
                        {theme.engagement_score !== undefined && (
                          <div style={s.themeStat}>
                            <span style={s.themeLabel}>Engagement</span>
                            <strong style={s.themeValue}>{(theme.engagement_score * 10).toFixed(1)}/10</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Geographic Concentration */}
                    {theme.geographic_concentration && theme.geographic_concentration.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>📍 Geographic Focus:</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {theme.geographic_concentration.map((region, i) => (
                            <span key={i} style={s.geoTag}>{region}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample Tweets */}
                    {theme.sample_tweets && theme.sample_tweets.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>💬 Sample Tweets:</div>
                        {theme.sample_tweets.slice(0, 2).map((tweet, i) => (
                          <div key={i} style={s.sampleTweet}>
                            "{tweet}"
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Market Impact & Risk */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.5rem' }}>
                      {theme.market_impact && (
                        <div style={{ fontSize: '0.85rem', color: '#8b5cf6' }}>
                          📊 Impact: <strong>{theme.market_impact}</strong>
                        </div>
                      )}
                      {theme.risk_level && (
                        <div style={{
                          ...s.riskAlert,
                          ...(theme.risk_level === 'high' ? { background: 'rgba(239,68,68,0.1)', color: '#fca5a5' } : {})
                        }}>
                          <AlertCircle size={14} />
                          Risk: {theme.risk_level}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentiment Breakdown - ENHANCED with Drivers */}
          {result.sentiment_breakdown && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Activity size={24} /> Sentiment Breakdown</h2>
              </div>
              <div style={s.sentimentGrid}>
                <div style={s.sentimentBar}>
                  <div style={{...s.sentimentFill, ...s.sentimentPositive, width: `${result.sentiment_breakdown.positive || 0}%`}}>
                    {result.sentiment_breakdown.positive || 0}% Positive
                  </div>
                </div>
                <div style={s.sentimentBar}>
                  <div style={{...s.sentimentFill, ...s.sentimentNeutral, width: `${result.sentiment_breakdown.neutral || 0}%`}}>
                    {result.sentiment_breakdown.neutral || 0}% Neutral
                  </div>
                </div>
                <div style={s.sentimentBar}>
                  <div style={{...s.sentimentFill, ...s.sentimentNegative, width: `${result.sentiment_breakdown.negative || 0}%`}}>
                    {result.sentiment_breakdown.negative || 0}% Negative
                  </div>
                </div>
                {result.sentiment_breakdown.mixed !== undefined && result.sentiment_breakdown.mixed > 0 && (
                  <div style={s.sentimentBar}>
                    <div style={{...s.sentimentFill, background: 'rgba(139,92,246,0.6)', color: '#c4b5fd', width: `${result.sentiment_breakdown.mixed}%`}}>
                      {result.sentiment_breakdown.mixed}% Mixed
                    </div>
                  </div>
                )}
              </div>

              {/* Sentiment Drivers */}
              {result.sentiment_breakdown.sentiment_drivers && (
                <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {result.sentiment_breakdown.sentiment_drivers.positive && result.sentiment_breakdown.sentiment_drivers.positive.length > 0 && (
                    <div style={s.driverCard}>
                      <h4 style={{ ...s.driverTitle, color: '#10b981' }}>✅ Positive Drivers</h4>
                      <ul style={s.driverList}>
                        {result.sentiment_breakdown.sentiment_drivers.positive.map((driver, i) => (
                          <li key={i} style={s.driverItem}>{driver}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.sentiment_breakdown.sentiment_drivers.negative && result.sentiment_breakdown.sentiment_drivers.negative.length > 0 && (
                    <div style={s.driverCard}>
                      <h4 style={{ ...s.driverTitle, color: '#ef4444' }}>⚠️ Negative Drivers</h4>
                      <ul style={s.driverList}>
                        {result.sentiment_breakdown.sentiment_drivers.negative.map((driver, i) => (
                          <li key={i} style={s.driverItem}>{driver}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Viral Content - ENHANCED with Engagement Patterns */}
          {result.viral_content_analysis?.top_performing_tweets && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Zap size={24} /> Viral Content Analysis</h2>
              </div>
              <div style={s.viralGrid}>
                {result.viral_content_analysis.top_performing_tweets.map((tweet, idx) => (
                  <div key={idx} style={s.viralCard}>
                    <div style={s.viralRank}>#{idx + 1}</div>
                    <p style={s.viralText}>{tweet.text_preview}</p>
                    <div style={s.viralStats}>
                      <span>👁️ {tweet.views?.toLocaleString() || 'N/A'} views</span>
                      <span>❤️ {tweet.engagement_total?.toLocaleString() || 'N/A'} engagements</span>
                      <span>🔥 {((tweet.virality_score || 0) * 10).toFixed(1)}/10 virality</span>
                    </div>
                    {tweet.why_it_matters && (
                      <div style={s.viralInsight}>
                        <strong>💡 Why it matters:</strong> {tweet.why_it_matters}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Engagement Patterns */}
              {result.viral_content_analysis.engagement_patterns && (
                <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {result.viral_content_analysis.engagement_patterns.high_engagement_content_types && (
                    <div style={s.patternCard}>
                      <h4 style={{ ...s.patternTitle, color: '#10b981' }}>📈 High Engagement Content</h4>
                      <ul style={s.patternList}>
                        {result.viral_content_analysis.engagement_patterns.high_engagement_content_types.map((type, i) => (
                          <li key={i} style={s.patternItem}>{type}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.viral_content_analysis.engagement_patterns.low_engagement_content_types && (
                    <div style={s.patternCard}>
                      <h4 style={{ ...s.patternTitle, color: '#94a3b8' }}>📉 Low Engagement Content</h4>
                      <ul style={s.patternList}>
                        {result.viral_content_analysis.engagement_patterns.low_engagement_content_types.map((type, i) => (
                          <li key={i} style={s.patternItem}>{type}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* NEW: Geographic Insights */}
          {result.geographic_insights?.regions && result.geographic_insights.regions.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Globe size={24} /> Geographic Insights</h2>
              </div>
              <div style={s.geoGrid}>
                {result.geographic_insights.regions.map((region, idx) => (
                  <div key={idx} style={s.geoCard}>
                    <div style={s.geoHeader}>
                      <h3 style={s.geoTitle}>📍 {region.region}</h3>
                      <span style={s.volumeBadge}>{region.volume_percentage}%</span>
                    </div>
                    <p style={s.geoInsight}>{region.unique_insight}</p>
                    
                    {region.dominant_themes && region.dominant_themes.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>🔥 Dominant Themes:</div>
                        {region.dominant_themes.map((theme, i) => (
                          <div key={i} style={s.geoThemeTag}>{theme}</div>
                        ))}
                      </div>
                    )}
                    
                    {region.language && region.language.length > 0 && (
                      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#8b5cf6' }}>
                        🌐 Languages: {region.language.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEW: Competitor Intelligence */}
          {result.competitor_intelligence?.active_players && result.competitor_intelligence.active_players.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Target size={24} /> Competitor Intelligence</h2>
              </div>
              <div style={s.competitorGrid}>
                {result.competitor_intelligence.active_players.map((player, idx) => (
                  <div key={idx} style={s.competitorCard}>
                    <div style={s.competitorHeader}>
                      <h3 style={s.competitorName}>{player.entity}</h3>
                      <span style={{
                        ...s.positionBadge,
                        ...(player.market_position === 'leader' ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' } : 
                            player.market_position === 'emerging' ? { background: 'rgba(251,191,36,0.2)', color: '#fcd34d' } : {})
                      }}>
                        {player.market_position}
                      </span>
                    </div>
                    <p style={s.competitorActivity}>🎯 {player.activity}</p>
                    <p style={s.competitorNote}>📝 {player.strategic_note}</p>
                    {player.sentiment && (
                      <div style={{
                        ...s.sentimentBadge,
                        ...(player.sentiment === 'positive' ? s.sentimentPositive : s.sentimentNeutral),
                        marginTop: '0.75rem'
                      }}>
                        Sentiment: {player.sentiment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEW: Consumer Behavior Insights */}
          {result.consumer_behavior_insights && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Users size={24} /> Consumer Behavior Insights</h2>
              </div>
              
              {result.consumer_behavior_insights.key_behaviors && result.consumer_behavior_insights.key_behaviors.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={s.sectionSubtitle}>Key Behaviors</h3>
                  {result.consumer_behavior_insights.key_behaviors.map((behavior, idx) => (
                    <div key={idx} style={s.behaviorCard}>
                      <h4 style={s.behaviorTitle}>{behavior.behavior}</h4>
                      <p style={s.behaviorDesc}>{behavior.description}</p>
                      <div style={s.behaviorMeta}>
                        <div><strong>Implication:</strong> {behavior.implication}</div>
                        <div style={{ color: '#10b981', marginTop: '0.5rem' }}>
                          <strong>💼 Business Opportunity:</strong> {behavior.business_opportunity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.consumer_behavior_insights.usage_patterns?.peak_interest_topics && (
                <div>
                  <h3 style={s.sectionSubtitle}>Peak Interest Topics</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {result.consumer_behavior_insights.usage_patterns.peak_interest_topics.map((topic, i) => (
                      <span key={i} style={s.topicTag}>{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emerging Opportunities */}
          {result.emerging_opportunities && result.emerging_opportunities.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Sparkles size={24} /> Emerging Opportunities</h2>
              </div>
              {result.emerging_opportunities.map((opp, idx) => (
                <div key={idx} style={s.opportunityCard}>
                  <h3 style={s.oppTitle}>{opp.opportunity}</h3>
                  <p style={s.oppDesc}>{opp.description}</p>
                  <div style={s.oppMeta}>
                    <span>📊 Market Size: <strong>{opp.market_size_indicator}</strong></span>
                    <span>⏱️ Timeline: <strong>{opp.time_horizon}</strong></span>
                  </div>
                  {opp.target_audience && opp.target_audience.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>🎯 Target Audience: </span>
                      {opp.target_audience.map((aud, i) => (
                        <span key={i} style={s.audienceTag}>{aud}</span>
                      ))}
                    </div>
                  )}
                  {opp.supporting_evidence && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                      💡 {opp.supporting_evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Risk Alerts - ENHANCED */}
          {result.risk_alerts && result.risk_alerts.length > 0 && (
            <div style={{...s.card, borderColor: 'rgba(239,68,68,0.3)'}}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><AlertCircle size={24} style={{ color: '#ef4444' }} /> Risk Alerts</h2>
              </div>
              {result.risk_alerts.map((risk, idx) => (
                <div key={idx} style={s.riskCard}>
                  <div style={s.riskHeader}>
                    <h3 style={s.riskTitle}>{risk.risk}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{
                        ...s.count,
                        background: risk.severity === 'critical' || risk.severity === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)',
                        color: risk.severity === 'critical' || risk.severity === 'high' ? '#fca5a5' : '#fcd34d'
                      }}>
                        {risk.severity?.toUpperCase()}
                      </span>
                      {risk.probability && (
                        <span style={{...s.count, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd'}}>
                          {risk.probability} probability
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={s.riskDesc}>{risk.description}</p>
                  
                  {risk.affected_stakeholders && risk.affected_stakeholders.length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                      👥 Affected: {risk.affected_stakeholders.join(', ')}
                    </div>
                  )}
                  
                  {risk.recommended_action && (
                    <div style={{...s.actionBox, marginTop: '1rem'}}>
                      <strong>🛡️ Recommended Action:</strong> {risk.recommended_action}
                    </div>
                  )}
                  
                  {risk.time_sensitivity && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#f59e0b', fontWeight: '600' }}>
                      ⏰ Time Sensitivity: {risk.time_sensitivity}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* NEW: Recommended Actions */}
          {result.recommended_actions && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><CheckCircle size={24} /> Recommended Actions</h2>
              </div>
              
              {result.recommended_actions.immediate && result.recommended_actions.immediate.length > 0 && (
                <div style={s.actionSection}>
                  <h3 style={{...s.actionSectionTitle, color: '#ef4444'}}>🔥 Immediate Actions</h3>
                  <ul style={s.actionList}>
                    {result.recommended_actions.immediate.map((action, i) => (
                      <li key={i} style={s.actionItem}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.recommended_actions.short_term && result.recommended_actions.short_term.length > 0 && (
                <div style={s.actionSection}>
                  <h3 style={{...s.actionSectionTitle, color: '#f59e0b'}}>📅 Short-Term Actions</h3>
                  <ul style={s.actionList}>
                    {result.recommended_actions.short_term.map((action, i) => (
                      <li key={i} style={s.actionItem}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.recommended_actions.strategic && result.recommended_actions.strategic.length > 0 && (
                <div style={s.actionSection}>
                  <h3 style={{...s.actionSectionTitle, color: '#8b5cf6'}}>🎯 Strategic Actions</h3>
                  <ul style={s.actionList}>
                    {result.recommended_actions.strategic.map((action, i) => (
                      <li key={i} style={s.actionItem}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* NEW: Metadata */}
          {result.metadata && (
            <div style={{...s.card, background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)'}}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><BarChart3 size={24} /> Analysis Metadata</h2>
              </div>
              <div style={s.metadataGrid}>
                {result.metadata.total_engagement && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Total Engagement</span>
                    <span style={s.metadataValue}>{result.metadata.total_engagement.toLocaleString()}</span>
                  </div>
                )}
                {result.metadata.total_views && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Total Views</span>
                    <span style={s.metadataValue}>{result.metadata.total_views.toLocaleString()}</span>
                  </div>
                )}
                {result.metadata.avg_engagement_rate !== undefined && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Avg Engagement Rate</span>
                    <span style={s.metadataValue}>{(result.metadata.avg_engagement_rate * 100).toFixed(1)}%</span>
                  </div>
                )}
                {result.metadata.data_quality_score !== undefined && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Data Quality</span>
                    <span style={s.metadataValue}>{(result.metadata.data_quality_score * 100).toFixed(0)}%</span>
                  </div>
                )}
                {result.metadata.languages_detected && result.metadata.languages_detected.length > 0 && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Languages Detected</span>
                    <span style={s.metadataValue}>{result.metadata.languages_detected.join(', ')}</span>
                  </div>
                )}
                {result.metadata.next_analysis_recommended && (
                  <div style={s.metadataItem}>
                    <span style={s.metadataLabel}>Next Analysis</span>
                    <span style={s.metadataValue}>{new Date(result.metadata.next_analysis_recommended).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isLocationOutput) {
      const city = result.trend_pulse?.location?.city || selectedCity.split(',')[0];
      const country = result.trend_pulse?.location?.country || selectedCity.split(',')[1]?.trim() || '';
      
      return (
        <div style={s.results}>
          {/* Header */}
          <div style={s.resultHeader}>
            <div>
              <div style={s.badge2}>📍 Analysis Complete</div>
              <h1 style={s.reportTitle}>Location Trend Analysis</h1>
              <p style={s.reportSubtitle}>
                📌 <strong>{city}</strong>{country && `, ${country}`}
                {result.trend_pulse?.analysis_timestamp && (
                  <> • {new Date(result.trend_pulse.analysis_timestamp).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <button onClick={() => setResult(null)} style={s.newBtn}>
              <Search size={18} /> New Analysis
            </button>
          </div>

          {/* Executive Summary */}
          {result.executive_summary && (
            <div style={{...s.card, ...s.highlightCard}}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Sparkles size={24} /> Executive Summary</h2>
                {result.executive_summary.urgency_level && (
                  <span style={s.count}>{result.executive_summary.urgency_level}</span>
                )}
              </div>
              <h3 style={s.summaryHeadline}>{result.executive_summary.headline}</h3>
              <p style={s.summaryInsight}><strong>Key Insight:</strong> {result.executive_summary.key_insight}</p>
              {result.executive_summary.market_opportunity && (
                <div style={s.actionBox}>
                  <strong>💡 Market Opportunity:</strong> {result.executive_summary.market_opportunity}
                </div>
              )}
            </div>
          )}

          {/* Trend Pulse Stats */}
          {result.trend_pulse && (
            <div style={s.statsGrid}>
              {result.trend_pulse.trends_analyzed && (
                <div style={s.statCard}>
                  <TrendingUp size={32} style={{ color: '#8b5cf6', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{result.trend_pulse.trends_analyzed}</div>
                  <div style={s.statLabel}>Trends Analyzed</div>
                </div>
              )}
              {result.trend_pulse.overall_mood && (
                <div style={s.statCard}>
                  <Activity size={32} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{result.trend_pulse.overall_mood}</div>
                  <div style={s.statLabel}>Overall Mood</div>
                </div>
              )}
              {result.trend_pulse.confidence_score && (
                <div style={s.statCard}>
                  <CheckCircle size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                  <div style={s.statValue}>{(result.trend_pulse.confidence_score * 100).toFixed(0)}%</div>
                  <div style={s.statLabel}>Confidence</div>
                </div>
              )}
            </div>
          )}

          {/* Trend Categories Breakdown */}
          {result.trend_categories?.breakdown && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><BarChart3 size={24} /> Trend Categories</h2>
              </div>
              <div style={s.categoriesGrid2}>
                {result.trend_categories.breakdown.map((cat, idx) => (
                  <div key={idx} style={s.categoryCard2}>
                    <div style={s.categoryHeader}>
                      <h4 style={s.categoryTitle}>{cat.category}</h4>
                      <span style={s.categoryPercent}>{cat.percentage}%</span>
                    </div>
                    <div style={s.categoryMeta}>
                      <span>📊 {cat.trends_count} trends</span>
                      <span>📈 {cat.total_volume}</span>
                    </div>
                    <div style={{
                      ...s.momentumBadge,
                      ...(cat.momentum === 'High' || cat.momentum === 'Peak' ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' } :
                          cat.momentum === 'Emerging' ? { background: 'rgba(251,191,36,0.2)', color: '#fcd34d' } :
                          { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' })
                    }}>
                      {cat.momentum} Momentum
                    </div>
                    {cat.examples && cat.examples.length > 0 && (
                      <div style={s.categoryExamples}>
                        {cat.examples.slice(0, 3).map((ex, i) => (
                          <span key={i} style={s.exampleTag}>#{ex}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Trends Analysis */}
          {result.top_trends_analysis && result.top_trends_analysis.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><TrendingUp size={24} /> Top Trends</h2>
                <span style={s.count}>{result.top_trends_analysis.length} trends</span>
              </div>
              <div style={s.trendsGrid}>
                {result.top_trends_analysis.map((trend, idx) => (
                  <div key={idx} style={s.trendCard}>
                    <div style={s.trendHeader}>
                      <div style={s.trendRank}>#{trend.rank || idx + 1}</div>
                      <h3 style={s.trendTitle}>{trend.trend_name || trend.trend}</h3>
                    </div>
                    
                    {trend.volume && (
                      <div style={s.trendVolume}>
                        📈 Volume: {trend.volume}
                      </div>
                    )}

                    {trend.category && (
                      <div style={s.trendCategory}>{trend.category}</div>
                    )}

                    {/* Lifecycle & Sentiment */}
                    <div style={s.trendMeta}>
                      {trend.lifecycle_stage && (
                        <span style={s.metaTag}>🔄 {trend.lifecycle_stage}</span>
                      )}
                      {trend.sentiment && (
                        <span style={{
                          ...s.metaTag,
                          ...(trend.sentiment === 'Positive' ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' } :
                              trend.sentiment === 'Negative' || trend.sentiment === 'Mixed/Negative' ? { background: 'rgba(239,68,68,0.2)', color: '#fca5a5' } :
                              { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' })
                        }}>
                          {trend.sentiment}
                        </span>
                      )}
                    </div>

                    {/* Business Opportunity */}
                    {trend.business_opportunity && (
                      <div style={s.opportunitySection}>
                        <div style={s.oppHeader}>
                          <strong>💼 Business Opportunity</strong>
                          <span style={{
                            ...s.oppRating,
                            ...(trend.business_opportunity.rating === 'High' ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' } :
                                trend.business_opportunity.rating === 'Medium' ? { background: 'rgba(251,191,36,0.2)', color: '#fcd34d' } :
                                { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' })
                          }}>
                            {trend.business_opportunity.rating}
                          </span>
                        </div>
                        {trend.business_opportunity.sectors && trend.business_opportunity.sectors.length > 0 && (
                          <div style={s.sectors}>
                            {trend.business_opportunity.sectors.map((sector, i) => (
                              <span key={i} style={s.sectorTag}>{sector}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {trend.analysis && (
                      <p style={s.trendAnalysis}>{trend.analysis}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Intelligence Summary */}
          {result.market_intelligence_summary && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.h2}><Target size={24} /> Market Intelligence</h2>
              </div>
              
              {result.market_intelligence_summary.key_insights && (
                <div style={s.insightsGrid}>
                  {result.market_intelligence_summary.key_insights.map((insight, idx) => (
                    <div key={idx} style={s.insightCard}>
                      <h4 style={s.insightTitle}>� Insight #{idx + 1}</h4>
                      <p style={s.insightText}>{insight.insight}</p>
                      <div style={s.insightMeta}>
                        <span><strong>Implication:</strong> {insight.implication}</span>
                        <span style={s.confidenceBadge}>
                          {insight.confidence} confidence
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.market_intelligence_summary.final_assessment && (
                <div style={s.finalAssessment}>
                  <h4 style={s.assessmentTitle}>📊 Final Assessment</h4>
                  {result.market_intelligence_summary.final_assessment.city_trend_identity && (
                    <p style={s.assessmentText}>
                      <strong>Trend Identity:</strong> {result.market_intelligence_summary.final_assessment.city_trend_identity}
                    </p>
                  )}
                  {result.market_intelligence_summary.final_assessment.strategic_recommendation && (
                    <div style={s.actionBox}>
                      <strong>🎯 Strategic Recommendation:</strong> {result.market_intelligence_summary.final_assessment.strategic_recommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Fallback for unexpected structure
    return (
      <div style={s.card}>
        <h4 style={s.h2}>Analysis Results</h4>
        <pre style={s.jsonOutput}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

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
            <TrendingUp size={48} />
            <Sparkles size={24} style={s.sparkle} />
          </div>
          <h1 style={s.title}>TrendIQ Analysis</h1>
          <p style={s.subtitle}>Scan news, social media, and on-chain data to summarize emerging market trends</p>
        </div>
      )}

      <div style={s.main}>
        {!result && !loading && (
          <div style={s.inputCard}>
            {/* Mode Toggle */}
            <div style={s.modeSection}>
              <label style={s.label}>Analysis Mode</label>
              <div style={s.modeButtons}>
                <button
                  onClick={() => {
                    setAnalysisMode('keyword');
                    setSelectedCity('');
                  }}
                  style={{
                    ...s.modeBtn,
                    ...(analysisMode === 'keyword' ? s.modeBtnActive : {})
                  }}
                  className="mode-btn"
                >
                  <Search size={18} />
                  Keyword Analysis
                </button>
                <button
                  onClick={() => {
                    setAnalysisMode('location');
                    setKeyword('');
                  }}
                  style={{
                    ...s.modeBtn,
                    ...(analysisMode === 'location' ? s.modeBtnActive : {})
                  }}
                  className="mode-btn"
                >
                  <MapPin size={18} />
                  Location Analysis
                </button>
              </div>
            </div>

            {/* Conditional Inputs */}
            {analysisMode === 'keyword' ? (
              <div style={s.inputSection}>
                <label style={s.label}>Enter Keyword</label>
                <div style={s.inputWrapper}>
                  <Search size={20} style={s.inputIcon} />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g., Bitcoin, AI, Climate Change"
                    style={s.input}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              </div>
            ) : (
              <div style={s.inputSection}>
                <label style={s.label}>Select City</label>
                <div style={s.locationRow}>
                  <div style={{ ...s.inputWrapper, flex: 1, position: 'relative' }}>
                    <Globe size={20} style={s.inputIcon} />
                    <input
                      type="text"
                      placeholder="Search for a city..."
                      value={citySearch}
                      onChange={(e) => {
                        setCitySearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      style={{ ...s.input, paddingLeft: '3.5rem' }}
                    />
                    {showDropdown && citySearch && filteredCities.length > 0 && (
                      <div style={s.dropdown}>
                        {filteredCities.slice(0, 100).map((city, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedCity(city.name);
                              setCitySearch(city.name);
                              setShowDropdown(false);
                            }}
                            style={s.dropdownItem}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <MapPin size={14} style={{ color: '#9333ea', marginRight: '8px' }} />
                            {city.name}
                          </div>
                        ))}
                        {filteredCities.length > 100 && (
                          <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                            {filteredCities.length - 100} more cities... Keep typing to refine
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleUseMyLocation}
                    disabled={cities.length === 0}
                    style={s.locationBtn}
                    className="location-btn"
                  >
                    <MapPin size={16} />
                    Use My Location
                  </button>
                </div>
              </div>
            )}

            {error && <div style={s.error}><AlertCircle size={16} /> {error}</div>}

            <button onClick={handleSubmit} style={s.btn} className="submit-btn">
              <TrendingUp size={20} /> Analyze Trends
              <div style={s.btnGlow}></div>
            </button>
          </div>
        )}

        {loading && (
          <div style={s.loading}>
            <div style={s.loaderWrapper}>
              {/* Trend line path */}
              <svg width="120" height="120" viewBox="0 0 120 120" style={s.trendSvg}>
                <path
                  d="M 20,80 Q 40,20 60,50 T 100,40"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  style={s.trendPath}
                />
              </svg>
              {/* Magnifying glass rotating around */}
              <Search size={32} style={s.magnifyingGlass} />
            </div>
            <h2 style={s.loadTitle}>AI is analyzing trends...</h2>
            <p style={s.loadText}>Scanning social media, news, and market data</p>
            <p style={s.loadSubtext}>This may take a moment. Please wait...</p>
            <div style={s.loadingBar}>
              <div style={{
                ...s.loadingBarFill,
                width: `${loadingProgress}%`,
                background: loadingProgress === 100 
                  ? 'linear-gradient(90deg, #10b981, #34d399)' 
                  : 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                transition: 'all 0.5s ease'
              }}></div>
            </div>
            <div style={s.progressText}>{Math.round(loadingProgress)}%</div>
          </div>
        )}

        {renderOutput()}
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
  inputCard: { maxWidth: '700px', margin: '0 auto', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '24px', padding: '3rem', boxShadow: '0 20px 60px rgba(139,92,246,0.2)' },
  modeSection: { marginBottom: '2rem' },
  label: { display: 'block', color: '#a5b4fc', fontSize: '0.95rem', marginBottom: '0.75rem', fontWeight: '500' },
  modeButtons: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  modeBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(139,92,246,0.05)', border: '2px solid rgba(139,92,246,0.2)', borderRadius: '12px', color: '#a5b4fc', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600', transition: 'all 0.3s ease' },
  modeBtnActive: { background: 'rgba(139,92,246,0.2)', border: '2px solid #8b5cf6', color: '#c4b5fd' },
  inputSection: { marginBottom: '2rem' },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', zIndex: 1 },
  input: { width: '100%', padding: '1.25rem 1.25rem 1.25rem 3.5rem', background: 'rgba(139,92,246,0.05)', border: '2px solid rgba(139,92,246,0.2)', borderRadius: '16px', color: '#e2e8f0', fontSize: '1rem', outline: 'none', transition: 'all 0.3s ease', boxSizing: 'border-box' },
  dropdown: { 
    position: 'absolute', 
    top: '100%', 
    left: 0, 
    right: 0, 
    marginTop: '0.5rem', 
    background: 'rgba(10,14,39,0.98)', 
    border: '2px solid rgba(139,92,246,0.3)', 
    borderRadius: '12px', 
    maxHeight: '300px', 
    overflowY: 'auto', 
    zIndex: 100,
    boxShadow: '0 10px 40px rgba(139,92,246,0.3)',
    backdropFilter: 'blur(20px)'
  },
  dropdownItem: { 
    display: 'flex', 
    alignItems: 'center', 
    padding: '12px 16px', 
    cursor: 'pointer', 
    color: '#e2e8f0', 
    fontSize: '0.95rem',
    borderBottom: '1px solid rgba(139,92,246,0.1)',
    transition: 'all 0.2s ease'
  },
  locationRow: { display: 'flex', gap: '1rem', alignItems: 'center' },
  locationBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1.5rem', background: 'rgba(59,130,246,0.2)', border: '2px solid rgba(59,130,246,0.3)', borderRadius: '16px', color: '#93c5fd', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600', transition: 'all 0.3s ease', whiteSpace: 'nowrap' },
  error: { display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' },
  btn: { position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1.5rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 10px 40px rgba(139,92,246,0.4)' },
  btnGlow: { position: 'absolute', inset: '-2px', background: 'linear-gradient(135deg, #c084fc, #e879f9)', filter: 'blur(20px)', opacity: 0.5, zIndex: -1 },
  loading: { textAlign: 'center', padding: '5rem 2rem' },
  loaderWrapper: { position: 'relative', width: '120px', height: '120px', margin: '0 auto 2rem' },
  trendSvg: { position: 'absolute', inset: 0, animation: 'dash 2s ease-in-out infinite' },
  trendPath: { strokeDasharray: '100', strokeDashoffset: '100', animation: 'draw 2s ease-in-out infinite' },
  magnifyingGlass: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%',
    color: '#ec4899',
    animation: 'orbit 3s linear infinite',
    transformOrigin: '60px 60px'
  },
  loadTitle: { fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', background: 'linear-gradient(135deg, #c084fc, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  loadText: { fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '0.5rem' },
  loadSubtext: { fontSize: '0.95rem', color: '#94a3b8', marginBottom: '2rem', fontStyle: 'italic' },
  loadingBar: { maxWidth: '400px', height: '8px', background: 'rgba(139,92,246,0.2)', borderRadius: '8px', margin: '0 auto', overflow: 'hidden', position: 'relative' },
  loadingBarFill: { height: '100%', borderRadius: '8px' },
  progressText: { marginTop: '1rem', fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' },
  results: { animation: 'fadeIn 0.8s ease' },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  badge2: { display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '20px', fontSize: '0.875rem', color: '#6ee7b7', marginBottom: '1rem', fontWeight: '600' },
  reportTitle: { fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #c084fc, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' },
  reportSubtitle: { fontSize: '1rem', color: '#a5b4fc' },
  newBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', color: 'white', padding: '1rem 2rem', borderRadius: '16px', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', boxShadow: '0 10px 30px rgba(139,92,246,0.3)' },
  card: { background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: '20px', padding: '2.5rem', marginBottom: '2rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  h2: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  count: { padding: '0.5rem 1rem', background: 'rgba(139,92,246,0.2)', borderRadius: '12px', fontSize: '0.875rem', color: '#c4b5fd', fontWeight: '600' },
  textContent: { fontSize: '1.1rem', lineHeight: '1.8', color: '#cbd5e1' },
  themesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  themeCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)', transition: 'all 0.3s ease' },
  themeTitle: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.75rem' },
  themeDesc: { fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1rem' },
  themeStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  themeStat: { display: 'flex', flexDirection: 'column' },
  themeLabel: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' },
  themeValue: { fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0' },
  categoriesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' },
  categoryCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)', textAlign: 'center' },
  categoryName: { fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '0.75rem', fontWeight: '600' },
  categoryCount: { fontSize: '2rem', fontWeight: '800', color: '#8b5cf6' },
  trendsGrid: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  trendCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  trendTitle: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.75rem' },
  trendAnalysis: { fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1rem' },
  trendVolume: { fontSize: '0.9rem', color: '#10b981', fontWeight: '600' },
  jsonOutput: { color: '#cbd5e1', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '0.875rem', lineHeight: '1.6' },
  
  // Enhanced Location Mode Styles
  highlightCard: { background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05))', border: '2px solid rgba(139,92,246,0.3)', boxShadow: '0 10px 40px rgba(139,92,246,0.2)' },
  summaryHeadline: { fontSize: '1.5rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '1rem', lineHeight: '1.4' },
  summaryInsight: { fontSize: '1.05rem', color: '#cbd5e1', lineHeight: '1.7', marginBottom: '1rem' },
  actionBox: { padding: '1rem 1.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', marginTop: '1rem', fontSize: '0.95rem', color: '#6ee7b7' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  statCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)', textAlign: 'center' },
  statValue: { fontSize: '2.25rem', fontWeight: '800', color: '#8b5cf6', margin: '0.5rem 0' },
  statLabel: { fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  
  categoriesGrid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
  categoryCard2: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)', transition: 'all 0.3s ease' },
  categoryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  categoryTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  categoryPercent: { fontSize: '1.5rem', fontWeight: '800', color: '#8b5cf6' },
  categoryMeta: { display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' },
  momentumBadge: { display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.75rem' },
  categoryExamples: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' },
  exampleTag: { padding: '0.4rem 0.8rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', fontSize: '0.8rem', color: '#c4b5fd' },
  
  trendHeader: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  trendRank: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', borderRadius: '12px', fontSize: '1.25rem', fontWeight: '800', color: 'white', flexShrink: 0 },
  trendCategory: { display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#93c5fd', marginBottom: '1rem', fontWeight: '600' },
  trendMeta: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' },
  metaTag: { padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600' },
  
  opportunitySection: { marginTop: '1rem', padding: '1rem', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' },
  oppHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', color: '#6ee7b7' },
  oppRating: { padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700' },
  sectors: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' },
  sectorTag: { padding: '0.4rem 0.8rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', fontSize: '0.8rem', color: '#c4b5fd' },
  
  insightsGrid: { display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' },
  insightCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  insightTitle: { fontSize: '1rem', fontWeight: '700', color: '#8b5cf6', marginBottom: '0.75rem' },
  insightText: { fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.7', marginBottom: '1rem' },
  insightMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#94a3b8' },
  confidenceBadge: { padding: '0.4rem 0.8rem', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', color: '#fcd34d', fontWeight: '600' },
  
  finalAssessment: { padding: '1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05))', borderRadius: '16px', border: '2px solid rgba(139,92,246,0.3)', marginTop: '1.5rem' },
  assessmentTitle: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '1rem' },
  assessmentText: { fontSize: '1rem', color: '#cbd5e1', lineHeight: '1.7', marginBottom: '1rem' },
  
  // NEW STYLES for enhanced keyword output
  geoTag: { padding: '0.4rem 0.8rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#93c5fd', display: 'inline-block' },
  sampleTweet: { padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid rgba(139,92,246,0.5)', borderRadius: '8px', fontSize: '0.9rem', color: '#cbd5e1', fontStyle: 'italic', marginBottom: '0.5rem' },
  driverCard: { padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.1)' },
  driverTitle: { fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' },
  driverList: { listStyle: 'none', padding: 0, margin: 0 },
  driverItem: { padding: '0.5rem 0', borderBottom: '1px solid rgba(139,92,246,0.05)', fontSize: '0.9rem', color: '#cbd5e1' },
  patternCard: { padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.1)' },
  patternTitle: { fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' },
  patternList: { listStyle: 'none', padding: 0, margin: 0 },
  patternItem: { padding: '0.5rem 0.75rem', background: 'rgba(139,92,246,0.05)', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' },
  geoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' },
  geoCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  geoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  geoTitle: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  geoInsight: { fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1rem' },
  geoThemeTag: { display: 'inline-block', padding: '0.4rem 0.8rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', fontSize: '0.8rem', color: '#c4b5fd', marginRight: '0.5rem', marginBottom: '0.5rem' },
  competitorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
  competitorCard: { padding: '1.5rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.1)' },
  competitorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  competitorName: { fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0', margin: 0 },
  positionBadge: { padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' },
  competitorActivity: { fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem' },
  competitorNote: { fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' },
  sectionSubtitle: { fontSize: '1.1rem', fontWeight: '700', color: '#a5b4fc', marginBottom: '1rem' },
  behaviorCard: { padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.1)', marginBottom: '1.5rem' },
  behaviorTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.75rem' },
  behaviorDesc: { fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1rem' },
  behaviorMeta: { fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.6' },
  topicTag: { display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', fontSize: '0.9rem', color: '#c4b5fd', fontWeight: '600' },
  audienceTag: { display: 'inline-block', padding: '0.3rem 0.6rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#93c5fd', marginLeft: '0.5rem' },
  actionSection: { marginBottom: '2rem' },
  actionSectionTitle: { fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  actionList: { listStyle: 'none', padding: 0, margin: 0 },
  actionItem: { padding: '1rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid rgba(139,92,246,0.5)', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6' },
  metadataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' },
  metadataItem: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  metadataLabel: { fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  metadataValue: { fontSize: '1.25rem', fontWeight: '700', color: '#e2e8f0' }
};

const css = document.createElement('style');
css.textContent = `
@keyframes fadeIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes sparkle{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.2) rotate(180deg)}}

@keyframes draw {
  0% { stroke-dashoffset: 100; }
  100% { stroke-dashoffset: 0; }
}

@keyframes dash {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes orbit {
  0% { 
    transform: translate(-50%, -50%) rotate(0deg) translateX(60px) rotate(0deg);
  }
  100% { 
    transform: translate(-50%, -50%) rotate(360deg) translateX(60px) rotate(-360deg);
  }
}

.mode-btn:hover { background: rgba(139,92,246,0.15) !important; transform: translateY(-2px); }
.location-btn:hover { background: rgba(59,130,246,0.3) !important; transform: translateY(-2px); }
.location-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.submit-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 50px rgba(139,92,246,0.5) !important; }
`;
document.head.appendChild(css);

export default TrendIQPage;
