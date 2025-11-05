/**
 * Campaign Service
 * Handles all campaign-related API calls to Supabase
 */

import { supabase } from '../../supabaseClient';

/**
 * Get all campaigns for the current user with progress stats
 */
export async function getCampaignsWithStats(userId) {
  try {
    const { data, error } = await supabase
      .rpc('get_campaign_with_stats', { p_user_id: userId });

    if (error) throw error;
    return { success: true, campaigns: data || [] };
  } catch (error) {
    console.error('❌ Error fetching campaigns:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get campaign templates
 */
export async function getCampaignTemplates() {
  try {
    const { data, error } = await supabase
      .from('campaign_templates')
      .select('*')
      .order('id');

    if (error) throw error;
    return { success: true, templates: data || [] };
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new campaign
 */
export async function createCampaign(userId, campaignData) {
  try {
    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert([{
        user_id: userId,
        name: campaignData.name,
        description: campaignData.description,
        status: campaignData.status || 'Active',
        template_type: campaignData.template_type || 'blank'
      }])
      .select()
      .single();

    if (campaignError) throw campaignError;

    // If agents are provided, add them as tasks
    if (campaignData.agent_ids && campaignData.agent_ids.length > 0) {
      const tasks = campaignData.agent_ids.map((agentId, index) => ({
        campaign_id: campaign.id,
        agent_id: agentId,
        order_index: index
      }));

      const { error: tasksError } = await supabase
        .from('campaign_tasks')
        .insert(tasks);

      if (tasksError) throw tasksError;
    }

    return { success: true, campaign };
  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single campaign with all its details
 */
export async function getCampaignById(campaignId) {
  try {
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    // Get campaign tasks with agent details
    const { data: tasks, error: tasksError } = await supabase
      .from('campaign_tasks')
      .select(`
        *,
        agent:agents(*)
      `)
      .eq('campaign_id', campaignId)
      .order('order_index');

    if (tasksError) throw tasksError;

    // Get campaign artifacts
    const { data: artifacts, error: artifactsError } = await supabase
      .from('campaign_artifacts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (artifactsError) throw artifactsError;

    // Get progress stats
    const { data: progress, error: progressError } = await supabase
      .rpc('get_campaign_progress', { p_campaign_id: campaignId });

    if (progressError) throw progressError;

    return {
      success: true,
      campaign: {
        ...campaign,
        tasks: tasks || [],
        artifacts: artifacts || [],
        progress: progress?.[0] || { total_tasks: 0, completed_tasks: 0, progress_percentage: 0 }
      }
    };
  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update campaign details
 */
export async function updateCampaign(campaignId, updates) {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, campaign: data };
  } catch (error) {
    console.error('❌ Error updating campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId) {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add an agent to a campaign
 */
export async function addAgentToCampaign(campaignId, agentId) {
  try {
    // Get current max order_index
    const { data: existingTasks } = await supabase
      .from('campaign_tasks')
      .select('order_index')
      .eq('campaign_id', campaignId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextIndex = existingTasks && existingTasks.length > 0 
      ? existingTasks[0].order_index + 1 
      : 0;

    const { data, error } = await supabase
      .from('campaign_tasks')
      .insert([{
        campaign_id: campaignId,
        agent_id: agentId,
        order_index: nextIndex
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, task: data };
  } catch (error) {
    console.error('❌ Error adding agent to campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove an agent from a campaign
 */
export async function removeAgentFromCampaign(campaignId, agentId) {
  try {
    const { error } = await supabase
      .from('campaign_tasks')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('agent_id', agentId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('❌ Error removing agent from campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark a task as complete
 */
export async function markTaskComplete(campaignId, agentId, isComplete = true) {
  try {
    const { data, error } = await supabase
      .from('campaign_tasks')
      .update({ is_complete: isComplete })
      .eq('campaign_id', campaignId)
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, task: data };
  } catch (error) {
    console.error('❌ Error updating task status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all agents (for adding to campaigns)
 */
export async function getAllAgents() {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('name');

    if (error) throw error;
    return { success: true, agents: data || [] };
  } catch (error) {
    console.error('❌ Error fetching agents:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get artifacts for a specific campaign
 */
export async function getCampaignArtifacts(campaignId) {
  try {
    const { data, error } = await supabase
      .from('campaign_artifacts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, artifacts: data || [] };
  } catch (error) {
    console.error('❌ Error fetching artifacts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle campaign task completion - saves artifact and marks task complete
 * Allows multiple runs - creates new artifact each time
 */
export async function handleCampaignTaskCompletion(campaignId, agentId, agentName, logId, outputData, outputSummary) {
  try {
    console.log('🔍 Starting campaign task completion...');
    console.log('   Campaign ID:', campaignId);
    console.log('   Agent ID:', agentId);
    console.log('   Agent Name:', agentName);
    console.log('   Log ID:', logId);

    // 1. Create artifact (allows multiple artifacts per task)
    const { data: artifact, error: artifactError } = await supabase
      .from('campaign_artifacts')
      .insert([{
        campaign_id: campaignId,
        log_id: logId,
        agent_name: agentName,
        output_summary: outputSummary,
        output_data: outputData
      }])
      .select()
      .single();

    if (artifactError) {
      console.error('❌ Artifact creation error:', artifactError);
      throw artifactError;
    }
    
    console.log('✅ Artifact created, ID:', artifact.id);

    // 2. First, check if the task exists
    const { data: existingTask, error: checkError } = await supabase
      .from('campaign_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('agent_id', agentId)
      .single();

    if (checkError) {
      console.error('❌ Task lookup error:', checkError);
      console.log('   This might mean the task doesn\'t exist in campaign_tasks table');
      return { success: true, artifact, taskUpdateSkipped: true };
    }

    console.log('✅ Task found:', existingTask);
    console.log('   Current is_complete status:', existingTask.is_complete);

    // 3. Mark task as complete (only if not already complete)
    const { data: updatedTask, error: taskError } = await supabase
      .from('campaign_tasks')
      .update({ 
        is_complete: true,
        completed_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .eq('agent_id', agentId)
      .select();

    if (taskError) {
      console.error('❌ Task update error:', taskError);
      console.log('   Error code:', taskError.code);
      console.log('   Error message:', taskError.message);
      console.log('   Error details:', taskError.details);
      console.log('   Error hint:', taskError.hint);
      // Don't fail the whole operation, artifact was created successfully
      return { success: true, artifact, taskUpdateFailed: true, error: taskError };
    }

    console.log('✅ Task update result:', updatedTask);
    console.log('   Rows updated:', updatedTask?.length || 0);

    return { success: true, artifact };
  } catch (error) {
    console.error('❌ Error completing campaign task:', error);
    return { success: false, error: error.message };
  }
}
