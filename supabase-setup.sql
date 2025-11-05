-- ============================================
-- SUPABASE TOKEN DEDUCTION SYSTEM SETUP
-- ============================================

-- Step 1: Ensure agents table has the correct structure
-- First, check if table exists and add missing columns if needed
DO $$ 
BEGIN
    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.agents (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add tokens_cost column if it doesn't exist (handles both cost and tokens_cost naming)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agents' AND column_name='tokens_cost') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agents' AND column_name='cost') THEN
            ALTER TABLE public.agents RENAME COLUMN cost TO tokens_cost;
        ELSE
            ALTER TABLE public.agents ADD COLUMN tokens_cost INTEGER NOT NULL DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Step 2: Ensure profiles table has the correct structure
-- Run this if the table doesn't exist or needs updating
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    tokens_remaining INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create token usage log table to track all transactions
CREATE TABLE IF NOT EXISTS public.token_usage_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id BIGINT REFERENCES public.agents(id),
    agent_name TEXT NOT NULL,
    tokens_deducted INTEGER NOT NULL,
    tokens_before INTEGER NOT NULL,
    tokens_after INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    request_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_usage_log_user_id ON public.token_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_log_agent_id ON public.token_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_log_created_at ON public.token_usage_log(created_at);

-- Step 5: Insert agent data with token costs
-- NOTE: WhatsPulse has a base cost of 50 tokens PER CONTACT (will be multiplied by contact count in frontend)
-- NOTE: TrendIQ has a base cost of 1 token (will be multiplied by 150 for location mode or 250 for keyword mode in frontend)

-- First, clean up any duplicate agents with wrong IDs
-- Update foreign key references before deleting
UPDATE public.token_usage_log SET agent_id = 8 WHERE agent_id = 29 AND agent_name = 'Scriptly';
UPDATE public.token_usage_log SET agent_id = 9 WHERE agent_id = 30 AND agent_name = 'Adbrief';
UPDATE public.usage_logs SET agent_id = 8 WHERE agent_id = 29 AND agent_name = 'Scriptly';
UPDATE public.usage_logs SET agent_id = 9 WHERE agent_id = 30 AND agent_name = 'Adbrief';

-- Now safe to delete duplicates
DELETE FROM public.agents WHERE id > 10;

INSERT INTO public.agents (id, name, description, tokens_cost) 
VALUES 
    (1, 'SEOrix', 'AI agent for search engine optimization', 200),
    (2, 'LeadGen', 'Intelligent lead generation and contact discovery', 150),
    (3, 'WhatsPulse', 'Automates WhatsApp marketing campaigns - 50 tokens per contact', 50),
    (4, 'AdVisor', 'Creates optimized ad titles and visuals', 200),
    (5, 'SociaPlan', 'Social Media Calendar Generator - Full week content planning', 250),
    (6, 'EchoMind', 'Analyzes customer recordings for sentiment patterns', 150),
    (7, 'TrendIQ', 'Scans news, social media, and on-chain data - 150 tokens (location) or 250 tokens (keyword)', 1),
    (8, 'Scriptly', 'Generate viral short-form video scripts for YouTube Shorts, Instagram Reels, TikTok, and LinkedIn', 300),
    (9, 'Adbrief', 'Generate creative ad briefs with multiple strategic angles and variations', 75),
    (10, 'ClipGen', 'Transform long-form content into viral short-form social media clips with AI-powered virality scoring', 350)
ON CONFLICT (id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tokens_cost = EXCLUDED.tokens_cost;

-- Update the sequence to continue from 10
SELECT setval('agents_id_seq', 10, true);

-- Step 6: Create function to check if user has sufficient tokens
-- Now supports token_multiplier for agents like WhatsPulse (50 tokens per contact)
CREATE OR REPLACE FUNCTION public.check_user_tokens(
    p_user_id UUID,
    p_agent_name TEXT,
    p_token_multiplier INTEGER DEFAULT 1
)
RETURNS TABLE (
    has_tokens BOOLEAN,
    current_tokens INTEGER,
    required_tokens INTEGER,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_tokens INTEGER;
    v_base_cost INTEGER;
    v_required_tokens INTEGER;
BEGIN
    -- Get user's current token balance
    SELECT tokens_remaining INTO v_current_tokens
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Get agent's base token cost
    SELECT tokens_cost INTO v_base_cost
    FROM public.agents
    WHERE name = p_agent_name;
    
    -- Calculate required tokens (base cost × multiplier)
    v_required_tokens := v_base_cost * p_token_multiplier;
    
    -- Check if user exists
    IF v_current_tokens IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, COALESCE(v_required_tokens, 0), 'User profile not found';
        RETURN;
    END IF;
    
    -- Check if agent exists
    IF v_base_cost IS NULL THEN
        RETURN QUERY SELECT FALSE, v_current_tokens, 0, 'Agent not found';
        RETURN;
    END IF;
    
    -- Check if user has sufficient tokens
    IF v_current_tokens >= v_required_tokens THEN
        RETURN QUERY SELECT TRUE, v_current_tokens, v_required_tokens, 'Sufficient tokens';
    ELSE
        RETURN QUERY SELECT FALSE, v_current_tokens, v_required_tokens, 'Insufficient tokens';
    END IF;
END;
$$;

-- Step 7: Create function to deduct tokens after successful operation
-- Now supports token_multiplier for agents like WhatsPulse (50 tokens per contact)
CREATE OR REPLACE FUNCTION public.deduct_tokens(
    p_user_id UUID,
    p_agent_name TEXT,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL,
    p_request_data JSONB DEFAULT NULL,
    p_token_multiplier INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    tokens_deducted INTEGER,
    tokens_remaining INTEGER,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent_id BIGINT;
    v_base_cost INTEGER;
    v_tokens_cost INTEGER;
    v_tokens_before INTEGER;
    v_tokens_after INTEGER;
BEGIN
    -- Get agent details
    SELECT id, tokens_cost INTO v_agent_id, v_base_cost
    FROM public.agents
    WHERE name = p_agent_name;
    
    -- Calculate total cost (base cost × multiplier)
    v_tokens_cost := v_base_cost * p_token_multiplier;
    
    -- Check if agent exists
    IF v_agent_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'Agent not found';
        RETURN;
    END IF;
    
    -- Get current token balance
    SELECT tokens_remaining INTO v_tokens_before
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF v_tokens_before IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'User profile not found';
        RETURN;
    END IF;
    
    -- Only deduct tokens if operation was successful
    IF p_success THEN
        -- Check if user has sufficient tokens
        IF v_tokens_before < v_tokens_cost THEN
            RETURN QUERY SELECT FALSE, 0, v_tokens_before, 'Insufficient tokens';
            RETURN;
        END IF;
        
        -- Deduct tokens
        UPDATE public.profiles
        SET tokens_remaining = profiles.tokens_remaining - v_tokens_cost
        WHERE id = p_user_id
        RETURNING profiles.tokens_remaining INTO v_tokens_after;
        
        -- Log the transaction
        INSERT INTO public.token_usage_log (
            user_id, 
            agent_id, 
            agent_name, 
            tokens_deducted, 
            tokens_before, 
            tokens_after, 
            success,
            error_message,
            request_data
        ) VALUES (
            p_user_id,
            v_agent_id,
            p_agent_name,
            v_tokens_cost,
            v_tokens_before,
            v_tokens_after,
            TRUE,
            NULL,
            p_request_data
        );
        
        RETURN QUERY SELECT TRUE, v_tokens_cost, v_tokens_after, 'Tokens deducted successfully';
    ELSE
        -- Log failed attempt (no tokens deducted)
        INSERT INTO public.token_usage_log (
            user_id, 
            agent_id, 
            agent_name, 
            tokens_deducted, 
            tokens_before, 
            tokens_after, 
            success,
            error_message,
            request_data
        ) VALUES (
            p_user_id,
            v_agent_id,
            p_agent_name,
            0,
            v_tokens_before,
            v_tokens_before,
            FALSE,
            p_error_message,
            p_request_data
        );
        
        RETURN QUERY SELECT FALSE, 0, v_tokens_before, 'Operation failed - no tokens deducted';
    END IF;
END;
$$;

-- Step 8: Create function to get user's token usage history
CREATE OR REPLACE FUNCTION public.get_token_usage_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id BIGINT,
    agent_name TEXT,
    tokens_deducted INTEGER,
    tokens_before INTEGER,
    tokens_after INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tul.id,
        tul.agent_name,
        tul.tokens_deducted,
        tul.tokens_before,
        tul.tokens_after,
        tul.success,
        tul.error_message,
        tul.created_at
    FROM public.token_usage_log tul
    WHERE tul.user_id = p_user_id
    ORDER BY tul.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Step 9: Enable Row Level Security (RLS)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage_log ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS Policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view agents" ON public.agents;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own token usage" ON public.token_usage_log;

-- Agents table - everyone can read
CREATE POLICY "Anyone can view agents" ON public.agents
    FOR SELECT USING (true);

-- Profiles table - users can only see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Token usage log - users can only see their own logs
CREATE POLICY "Users can view own token usage" ON public.token_usage_log
    FOR SELECT USING (auth.uid() = user_id);

-- Step 11: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.agents TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.token_usage_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_token_usage_history TO authenticated;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Now you can use these functions in your frontend:
-- 1. check_user_tokens(user_id, agent_name) - Check before making API call
-- 2. deduct_tokens(user_id, agent_name, success, error_msg, request_data) - Deduct after successful response
-- 3. get_token_usage_history(user_id, limit) - View transaction history
-- ============================================

-- ============================================================================
-- NEW FEATURES: DASHBOARD KPIs, ANALYTICS, AND CAMPAIGNS
-- Run these additional queries to enable the new features
-- ============================================================================

-- ============================================================================
-- STEP 12: Create usage_logs table (simplified version for KPIs)
-- This table provides easier querying for dashboard KPIs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id BIGINT REFERENCES public.agents(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  tokens_spent INT NOT NULL DEFAULT 0,
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'success',
  campaign_id BIGINT NULL,  -- Will be linked to campaigns table
  input_data JSONB NULL,  -- Store the input parameters
  output_summary TEXT NULL,  -- Brief summary of the output
  output_data JSONB NULL  -- Full output data (optional, for viewing details)
);

-- Enable Row Level Security
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own usage logs." ON public.usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs." ON public.usage_logs;

-- Create Policy: Users can only see their own logs
CREATE POLICY "Users can view their own usage logs."
ON public.usage_logs FOR SELECT
USING (auth.uid() = user_id);

-- Create Policy: System can insert logs
CREATE POLICY "System can insert usage logs."
ON public.usage_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_agent_id ON public.usage_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_ran_at ON public.usage_logs(ran_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_campaign_id ON public.usage_logs(campaign_id);

-- ============================================================================
-- STEP 13: Create campaigns table
-- This allows users to group agent runs into projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8b5cf6',  -- Purple default
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own campaigns." ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns." ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns." ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns." ON public.campaigns;

-- Create Policy: Users can view their own campaigns
CREATE POLICY "Users can view their own campaigns."
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id);

-- Create Policy: Users can insert their own campaigns
CREATE POLICY "Users can insert their own campaigns."
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create Policy: Users can update their own campaigns
CREATE POLICY "Users can update their own campaigns."
ON public.campaigns FOR UPDATE
USING (auth.uid() = user_id);

-- Create Policy: Users can delete their own campaigns
CREATE POLICY "Users can delete their own campaigns."
ON public.campaigns FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);

-- ============================================================================
-- STEP 14: Create get_favorite_agent function
-- Returns the most frequently used agent for the current user
-- ============================================================================

-- Drop existing function if it exists (handles both with and without parameters)
DROP FUNCTION IF EXISTS public.get_favorite_agent();
DROP FUNCTION IF EXISTS public.get_favorite_agent(UUID);

CREATE OR REPLACE FUNCTION public.get_favorite_agent()
RETURNS TABLE(agent_name TEXT, run_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT l.agent_name, COUNT(l.id) AS run_count
  FROM public.usage_logs l
  WHERE l.user_id = auth.uid() AND l.status = 'success'
  GROUP BY l.agent_name
  ORDER BY run_count DESC
  LIMIT 1;
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.get_favorite_agent TO authenticated;

-- ============================================================================
-- STEP 15: Create function to get campaign stats
-- Returns stats for all campaigns
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_campaign_stats();
DROP FUNCTION IF EXISTS public.get_campaign_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_campaign_stats()
RETURNS TABLE(
  campaign_id bigint,
  campaign_name text,
  campaign_color text,
  total_runs bigint,
  total_tokens bigint,
  last_run timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.color,
    COUNT(l.id) as total_runs,
    COALESCE(SUM(l.tokens_spent), 0) as total_tokens,
    MAX(l.ran_at) as last_run
  FROM public.campaigns c
  LEFT JOIN public.usage_logs l ON c.id = l.campaign_id
  WHERE c.user_id = auth.uid()
  GROUP BY c.id, c.name, c.color
  ORDER BY last_run DESC NULLS LAST;
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.get_campaign_stats TO authenticated;

-- ============================================================================
-- STEP 16: Add updated_at trigger for campaigns
-- Automatically updates the updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- DONE! Your database now supports:
-- - Dynamic Dashboard KPIs (Total Runs, Tokens Spent, Favorite Agent)
-- - Usage Analytics with historical data
-- - Campaign management for grouping agent runs
-- - Complete activity logs
-- ============================================================================

-- ============================================================================
-- STEP 17: Create campaign_tasks table
-- This allows campaigns to have multiple tasks (agents to run)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_tasks (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Enable Row Level Security
ALTER TABLE public.campaign_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view tasks of their campaigns" ON public.campaign_tasks;
DROP POLICY IF EXISTS "Users can insert tasks to their campaigns" ON public.campaign_tasks;
DROP POLICY IF EXISTS "Users can update tasks of their campaigns" ON public.campaign_tasks;
DROP POLICY IF EXISTS "Users can delete tasks of their campaigns" ON public.campaign_tasks;

-- Create policies for campaign_tasks
CREATE POLICY "Users can view tasks of their campaigns"
ON public.campaign_tasks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_tasks.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can insert tasks to their campaigns"
ON public.campaign_tasks FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_tasks.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can update tasks of their campaigns"
ON public.campaign_tasks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_tasks.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can delete tasks of their campaigns"
ON public.campaign_tasks FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_tasks.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_tasks_campaign_id ON public.campaign_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_tasks_status ON public.campaign_tasks(status);

-- ============================================================================
-- STEP 18: Create campaign_artifacts table
-- Stores the output/results from completed campaign tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_artifacts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES public.campaign_tasks(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  output_data JSONB NOT NULL,
  output_summary TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.campaign_artifacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view artifacts of their campaigns" ON public.campaign_artifacts;
DROP POLICY IF EXISTS "Users can insert artifacts to their campaigns" ON public.campaign_artifacts;

-- Create policies for campaign_artifacts
CREATE POLICY "Users can view artifacts of their campaigns"
ON public.campaign_artifacts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_artifacts.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can insert artifacts to their campaigns"
ON public.campaign_artifacts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_artifacts.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_artifacts_campaign_id ON public.campaign_artifacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_artifacts_task_id ON public.campaign_artifacts(task_id);

-- ============================================================================
-- STEP 19: Add campaign status tracking
-- Campaigns can have different statuses
-- ============================================================================

-- Add status column to campaigns table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='campaigns' AND column_name='status'
    ) THEN
        ALTER TABLE public.campaigns 
        ADD COLUMN status TEXT DEFAULT 'not_started' 
        CHECK (status IN ('not_started', 'in_progress', 'completed'));
    END IF;
END $$;

-- ============================================================================
-- COMPLETE! Your database now fully supports:
-- ============================================================================
-- ✅ Token Management System
--    - User token balances
--    - Token deduction with multipliers
--    - Usage logging and history
--
-- ✅ Agent System
--    - 9 AI agents (SEOrix, LeadGen, WhatsPulse, AdVisor, SociaPlan, 
--      EchoMind, TrendIQ, Scriptly, Adbrief)
--    - Token costs per agent
--
-- ✅ Campaign Management
--    - Create campaigns with tasks
--    - Track campaign progress
--    - Store campaign artifacts/outputs
--    - Campaign status tracking
--
-- ✅ Analytics & Dashboard
--    - Total runs and tokens spent
--    - Favorite agent detection
--    - Usage logs with filtering
--    - Historical data tracking
--
-- ✅ Row Level Security (RLS)
--    - Users can only access their own data
--    - Proper authentication checks
--    - Secure function execution
-- ============================================================================
