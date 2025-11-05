/**
 * Token Service for Agent Token Deduction
 * 
 * This service handles:
 * 1. Checking user token balance before API calls
 * 2. Deducting tokens only after successful agent responses
 * 3. Logging all token transactions for audit trail
 * 4. Error handling and user notifications
 */

import { supabase } from '../../supabaseClient';

/**
 * Agent token costs mapping
 * Update these values to match your agents table in Supabase
 * 
 * NOTE: WhatsPulse charges 50 tokens PER CONTACT (multiply by contact count)
 */
export const AGENT_COSTS = {
  'SEOrix': 200,
  'LeadGen': 150,
  'WhatsPulse': 50, // Per contact - multiply by number of contacts
  'AdVisor': 200,
  'SociaPlan': 250,
  'EchoMind': 150,
  'TrendIQ': 1, // Base cost - multiply by actual cost (150 for location, 250 for keyword)
  'TrendIQ-Keyword': 250, // For reference only
  'TrendIQ-Location': 150, // For reference only
  'Scriptly': 300, // Fixed cost for generating viral video scripts
  'Adbrief': 75 // Fixed cost for generating ad briefs with multiple angles
};

/**
 * Check if user has sufficient tokens before making an API call
 * 
 * @param {string} userId - The authenticated user's ID
 * @param {string} agentName - Name of the agent (must match agents table)
 * @param {number} tokenMultiplier - Multiplier for token cost (default: 1). For WhatsPulse, use contact count
 * @returns {Promise<{hasTokens: boolean, currentTokens: number, requiredTokens: number, message: string}>}
 */
export async function checkUserTokens(userId, agentName, tokenMultiplier = 1) {
  try {
    // Call Supabase function to check token balance
    const { data, error } = await supabase
      .rpc('check_user_tokens', {
        p_user_id: userId,
        p_agent_name: agentName,
        p_token_multiplier: tokenMultiplier
      });

    if (error) {
      console.error('❌ Error checking tokens:', error);
      throw new Error(`Failed to check token balance: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No response from token check');
    }

    const result = data[0];
    
    console.log('✅ Token check result:', result);
    if (tokenMultiplier > 1) {
      console.log(`📊 Cost calculation: ${AGENT_COSTS[agentName]} tokens × ${tokenMultiplier} = ${result.required_tokens} tokens`);
    }

    return {
      hasTokens: result.has_tokens,
      currentTokens: result.current_tokens,
      requiredTokens: result.required_tokens,
      message: result.message
    };
  } catch (error) {
    console.error('❌ Token check error:', error);
    throw error;
  }
}

/**
 * Deduct tokens after successful agent operation
 * This should ONLY be called after receiving successful response from agent
 * 
 * @param {string} userId - The authenticated user's ID
 * @param {string} agentName - Name of the agent (must match agents table)
 * @param {boolean} success - Whether the agent operation was successful
 * @param {string} errorMessage - Optional error message if operation failed
 * @param {object} requestData - Optional request data for logging
 * @param {number} tokenMultiplier - Multiplier for token cost (default: 1). For WhatsPulse, use contact count
 * @param {string} outputSummary - Brief summary of the output for display
 * @param {object} outputData - Full output data (optional)
 * @param {number} campaignId - Optional campaign ID if this execution is part of a campaign
 * @returns {Promise<{success: boolean, tokensDeducted: number, tokensRemaining: number, message: string, logId: number|null}>}
 */
export async function deductTokens(userId, agentName, success = true, errorMessage = null, requestData = null, tokenMultiplier = 1, outputSummary = null, outputData = null, campaignId = null) {
  try {
    console.log(`💰 ${success ? 'Deducting' : 'Logging failed attempt for'} tokens for ${agentName}...`);
    if (tokenMultiplier > 1) {
      console.log(`📊 Multiplier: ${tokenMultiplier}x (e.g., ${tokenMultiplier} contacts)`);
    }

    // Call Supabase function to deduct tokens
    const { data, error } = await supabase
      .rpc('deduct_tokens', {
        p_user_id: userId,
        p_agent_name: agentName,
        p_success: success,
        p_error_message: errorMessage,
        p_request_data: requestData,
        p_token_multiplier: tokenMultiplier
      });

    if (error) {
      console.error('❌ Error deducting tokens:', error);
      throw new Error(`Failed to deduct tokens: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No response from token deduction');
    }

    const result = data[0];
    
    console.log(`✅ Token deduction result:`, result);

    // Also log to usage_logs table for the new dashboard features
    let logId = null;
    try {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('name', agentName)
        .single();
      
      if (agentError) {
        console.error('❌ Error fetching agent:', agentError);
      } else if (!agentError && agent) {
        console.log('📝 Inserting into usage_logs...');
        
        // Prepare log entry - sanitize large data to avoid insert errors
        let sanitizedOutputData = outputData;
        if (outputData) {
          try {
            const dataStr = JSON.stringify(outputData);
            // If output data is too large (>1MB), truncate it
            if (dataStr.length > 1000000) {
              console.warn('⚠️ Output data too large, truncating...');
              sanitizedOutputData = { 
                _truncated: true, 
                _size: dataStr.length,
                _message: 'Data too large to store'
              };
            }
          } catch (e) {
            console.warn('⚠️ Could not stringify output data:', e);
            sanitizedOutputData = { _error: 'Could not serialize data' };
          }
        }
        
        const logEntry = {
          user_id: userId,
          agent_id: agent.id,
          agent_name: agentName,
          tokens_spent: success ? result.tokens_deducted : 0,
          status: success ? 'success' : 'error',
          ran_at: new Date().toISOString(),
          campaign_id: campaignId, // Tag with campaign ID if provided
          input_data: requestData,
          output_summary: outputSummary,
          output_data: sanitizedOutputData
        };
        
        console.log('📋 Log entry data:', {
          user_id: userId,
          agent_id: agent.id,
          agent_name: agentName,
          tokens_spent: logEntry.tokens_spent,
          status: logEntry.status,
          campaign_id: campaignId || 'none',
          has_output_data: !!sanitizedOutputData
        });
        
        const { data: insertResult, error: logInsertError } = await supabase
          .from('usage_logs')
          .insert(logEntry)
          .select('id');
        
        if (logInsertError) {
          console.error('❌ Error inserting usage log:', logInsertError);
          console.error('Error details:', JSON.stringify(logInsertError, null, 2));
        } else if (insertResult && insertResult.length > 0) {
          logId = insertResult[0].id;
          console.log('✅ Usage log entry created with ID:', logId);
          if (campaignId) {
            console.log('🏷️ Tagged with campaign ID:', campaignId);
          }
        } else {
          console.warn('⚠️ Insert succeeded but no data returned');
        }
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log to usage_logs (non-critical):', logError);
      // Don't throw - this is a non-critical feature
    }

    return {
      success: result.success,
      tokensDeducted: result.tokens_deducted,
      tokensRemaining: result.tokens_remaining,
      message: result.message,
      logId: logId // Return the usage log ID for campaign artifacts
    };
  } catch (error) {
    console.error('❌ Token deduction error:', error);
    throw error;
  }
}

/**
 * Get user's token usage history
 * 
 * @param {string} userId - The authenticated user's ID
 * @param {number} limit - Maximum number of records to retrieve (default: 50)
 * @returns {Promise<Array>} Array of token usage records
 */
export async function getTokenUsageHistory(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .rpc('get_token_usage_history', {
        p_user_id: userId,
        p_limit: limit
      });

    if (error) {
      console.error('❌ Error fetching token history:', error);
      throw new Error(`Failed to fetch token history: ${error.message}`);
    }

    console.log('✅ Token usage history retrieved:', data?.length || 0, 'records');
    return data || [];
  } catch (error) {
    console.error('❌ Token history error:', error);
    throw error;
  }
}

/**
 * Get user's current token balance
 * 
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<number>} Current token balance
 */
export async function getCurrentTokenBalance(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tokens_remaining')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching token balance:', error);
      throw new Error(`Failed to fetch token balance: ${error.message}`);
    }

    console.log('✅ Current token balance:', data.tokens_remaining);
    return data.tokens_remaining;
  } catch (error) {
    console.error('❌ Token balance error:', error);
    throw error;
  }
}

/**
 * Format token amount with commas for display
 * 
 * @param {number} tokens - Token amount
 * @returns {string} Formatted token string
 */
export function formatTokens(tokens) {
  return tokens.toLocaleString();
}

/**
 * Get agent cost by name
 * 
 * @param {string} agentName - Name of the agent
 * @returns {number} Token cost for the agent
 */
export function getAgentCost(agentName) {
  return AGENT_COSTS[agentName] || 0;
}

/**
 * Wrapper function to handle the complete token flow for an agent operation
 * This is the recommended way to use the token service
 * 
 * Usage Example (Normal):
 * ```javascript
 * const result = await executeWithTokens(
 *   session.user.id,
 *   'SEOrix',
 *   async () => {
 *     const response = await fetch('...');
 *     return await response.json();
 *   },
 *   { url: 'https://example.com' },
 *   1,
 *   'SEO analysis for example.com',  // Summary
 *   null  // Campaign ID (optional)
 * );
 * ```
 * 
 * @param {string} userId - The authenticated user's ID
 * @param {string} agentName - Name of the agent
 * @param {Function} apiCallFunction - Async function that makes the API call
 * @param {object} requestData - Optional request data for logging
 * @param {number} tokenMultiplier - Multiplier for token cost (default: 1)
 * @param {string} outputSummary - Brief summary for display in history
 * @param {number} campaignId - Optional campaign ID if this is part of a campaign
 * @returns {Promise<{success: boolean, data?: any, error?: string, tokensRemaining?: number, tokensDeducted?: number, logId?: number|null}>}
 */
export async function executeWithTokens(userId, agentName, apiCallFunction, requestData = null, tokenMultiplier = 1, outputSummary = null, campaignId = null) {
  try {
    // Step 1: Check if user has sufficient tokens
    console.log(`🔍 Checking tokens for ${agentName}...`);
    const tokenCheck = await checkUserTokens(userId, agentName, tokenMultiplier);
    
    if (!tokenCheck.hasTokens) {
      const perUnitCost = tokenMultiplier > 1 ? ` (${AGENT_COSTS[agentName]} tokens × ${tokenMultiplier})` : '';
      return {
        success: false,
        error: `Insufficient tokens! You have ${tokenCheck.currentTokens} tokens but need ${tokenCheck.requiredTokens} tokens${perUnitCost} to use ${agentName}.`,
        currentTokens: tokenCheck.currentTokens,
        requiredTokens: tokenCheck.requiredTokens
      };
    }

    console.log(`✅ Sufficient tokens available. Proceeding with API call...`);

    // Step 2: Execute the API call
    let apiResult;
    let apiSuccess = false;
    let errorMessage = null;

    try {
      apiResult = await apiCallFunction();
      apiSuccess = true;
      console.log(`✅ API call successful for ${agentName}`);
    } catch (apiError) {
      apiSuccess = false;
      errorMessage = apiError.message || 'API call failed';
      console.error(`❌ API call failed for ${agentName}:`, apiError);
      
      // Log failed attempt (no tokens deducted)
      await deductTokens(userId, agentName, false, errorMessage, requestData, tokenMultiplier, outputSummary, null, campaignId);
      
      return {
        success: false,
        error: `Agent failed: ${errorMessage}`,
        currentTokens: tokenCheck.currentTokens
      };
    }

    // Step 3: Deduct tokens only if API call was successful
    console.log(`💰 Deducting ${tokenCheck.requiredTokens} tokens...`);
    const deductionResult = await deductTokens(userId, agentName, true, null, requestData, tokenMultiplier, outputSummary, apiResult, campaignId);

    if (!deductionResult.success) {
      console.warn(`⚠️ Token deduction failed but API call succeeded`);
      // This shouldn't happen, but we still return the API result
    }

    console.log(`✅ Complete! Tokens deducted: ${deductionResult.tokensDeducted}, Remaining: ${deductionResult.tokensRemaining}`);

    return {
      success: true,
      data: apiResult,
      tokensDeducted: deductionResult.tokensDeducted,
      tokensRemaining: deductionResult.tokensRemaining,
      message: deductionResult.message,
      logId: deductionResult.logId // Return log ID for campaign artifacts
    };

  } catch (error) {
    console.error(`❌ Token flow error for ${agentName}:`, error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}
