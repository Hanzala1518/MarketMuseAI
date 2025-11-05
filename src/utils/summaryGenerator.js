/**
 * Utility functions to generate meaningful titles and summaries for agent runs
 * Used in conjunction with tokenService to log conversation-style history
 */

/**
 * Generate a brief summary from agent output data
 * @param {string} agentName - Name of the agent
 * @param {object} inputData - Input parameters sent to agent
 * @param {object} outputData - Output data from agent
 * @returns {string} Brief summary for display
 */
export function generateSummary(agentName, inputData, outputData) {
  switch(agentName) {
    case 'TrendIQ':
      return generateTrendIQSummary(inputData, outputData);
    
    case 'SEOrix':
      return generateSEOrixSummary(inputData, outputData);
    
    case 'AdVisor':
      return generateAdVisorSummary(inputData, outputData);
    
    case 'EchoMind':
      return generateEchoMindSummary(inputData, outputData);
    
    case 'SociaPlan':
      return generateSociaPlanSummary(inputData, outputData);
    
    case 'WhatsPulse':
      return generateWhatsPulseSummary(inputData, outputData);
    
    case 'LeadGen':
      return generateLeadGenSummary(inputData, outputData);
    
    default:
      return `Completed ${agentName} analysis`;
  }
}

// Agent-specific summary generators

function generateTrendIQSummary(inputData, outputData) {
  const mode = inputData?.keyword ? 'keyword' : 'city';
  const subject = inputData?.keyword || inputData?.city || 'trends';
  
  if (!outputData) {
    return `Analyzed ${subject} trends`;
  }
  
  const themesCount = outputData.trending_themes?.length || 0;
  const hashtagsCount = outputData.hashtag_recommendations?.length || 0;
  
  return `Analyzed "${subject}" - Found ${themesCount} trending themes and ${hashtagsCount} recommended hashtags`;
}

function generateSEOrixSummary(inputData, outputData) {
  const url = inputData?.url || 'website';
  const domain = url.replace(/^https?:\/\//i, '').split('/')[0];
  
  if (!outputData) {
    return `SEO audit for ${domain}`;
  }
  
  const score = outputData.overall_score || outputData.seo_score;
  if (score) {
    return `SEO audit for ${domain} - Score: ${score}/100`;
  }
  
  return `Completed SEO analysis for ${domain}`;
}

function generateAdVisorSummary(inputData, outputData) {
  const platform = inputData?.platform || 'ad';
  const product = inputData?.product || inputData?.service || 'campaign';
  
  if (!outputData) {
    return `Generated ${platform} ad campaign for ${product}`;
  }
  
  const adsCount = outputData.ads?.length || outputData.variations?.length || 3;
  return `Created ${adsCount} ${platform} ad variations for ${product}`;
}

function generateEchoMindSummary(inputData, outputData) {
  const prompt = inputData?.prompt || inputData?.message || '';
  
  // Extract first few words from prompt for context
  const shortPrompt = prompt.slice(0, 60);
  const displayPrompt = shortPrompt.length < prompt.length ? `${shortPrompt}...` : shortPrompt;
  
  if (!outputData) {
    return displayPrompt || 'Chat conversation';
  }
  
  const response = outputData.response || outputData.message || outputData.text || '';
  const shortResponse = response.slice(0, 100);
  const displayResponse = shortResponse.length < response.length ? `${shortResponse}...` : shortResponse;
  
  return displayResponse || displayPrompt || 'Chat conversation completed';
}

function generateSociaPlanSummary(inputData, outputData) {
  const topic = inputData?.topic || inputData?.theme || 'content';
  const platform = inputData?.platform || 'social media';
  
  if (!outputData) {
    return `Generated ${platform} content about ${topic}`;
  }
  
  const postsCount = outputData.posts?.length || outputData.content?.length || 0;
  return `Created ${postsCount} ${platform} posts about ${topic}`;
}

function generateWhatsPulseSummary(inputData, outputData) {
  const contactCount = inputData?.contactCount || inputData?.contacts || 0;
  const campaignName = inputData?.campaignName || 'WhatsApp campaign';
  
  if (!outputData) {
    return `Sent campaign to ${contactCount} contacts`;
  }
  
  const successCount = outputData.sent || outputData.success || contactCount;
  return `Campaign "${campaignName}" sent to ${successCount}/${contactCount} contacts successfully`;
}

function generateLeadGenSummary(inputData, outputData) {
  const industry = inputData?.industry || inputData?.sector || 'target market';
  const location = inputData?.location || inputData?.city;
  
  if (!outputData) {
    const loc = location ? ` in ${location}` : '';
    return `Generated leads in ${industry}${loc}`;
  }
  
  const leadsCount = outputData.leads?.length || outputData.count || 0;
  const loc = location ? ` in ${location}` : '';
  return `Found ${leadsCount} qualified leads in ${industry}${loc}`;
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Extract key metrics from output data for quick display
 * @param {string} agentName - Name of the agent
 * @param {object} outputData - Output data from agent
 * @returns {object} Key-value pairs of important metrics
 */
export function extractKeyMetrics(agentName, outputData) {
  if (!outputData) return {};
  
  switch(agentName) {
    case 'TrendIQ':
      return {
        'Trending Themes': outputData.trending_themes?.length || 0,
        'Hashtags': outputData.hashtag_recommendations?.length || 0,
        'Engagement Score': outputData.engagement_score || 'N/A'
      };
    
    case 'SEOrix':
      return {
        'SEO Score': outputData.overall_score || outputData.seo_score || 'N/A',
        'Issues Found': outputData.issues?.length || 0,
        'Recommendations': outputData.recommendations?.length || 0
      };
    
    case 'AdVisor':
      return {
        'Ad Variations': outputData.ads?.length || outputData.variations?.length || 0,
        'Platform': outputData.platform || 'N/A'
      };
    
    case 'EchoMind':
      return {
        'Response Length': outputData.response?.length || outputData.message?.length || 0,
        'Tokens Used': outputData.tokens || 'N/A'
      };
    
    case 'SociaPlan':
      return {
        'Posts Created': outputData.posts?.length || 0,
        'Platform': outputData.platform || 'N/A'
      };
    
    case 'WhatsPulse':
      return {
        'Total Contacts': outputData.total || outputData.contacts || 0,
        'Sent Successfully': outputData.sent || outputData.success || 0,
        'Failed': outputData.failed || 0
      };
    
    case 'LeadGen':
      return {
        'Leads Found': outputData.leads?.length || outputData.count || 0,
        'Quality Score': outputData.quality_score || 'N/A'
      };
    
    default:
      return {};
  }
}
