# 🎯 Market Muse AI — Multi-Agent Marketing Workspace

An all-in-one React + Vite application featuring a marketplace of 9 AI marketing agents with beautiful inline-styled UIs, campaign management, analytics dashboard, and webhook-based automations.

[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-purple)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Database Setup](#database-setup)
- [Available Agents](#available-agents)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Feature Implementations](#feature-implementations)
- [Troubleshooting](#troubleshooting)
- [Recent Updates](#recent-updates)

---

## 🌟 Overview

Market Muse AI is a comprehensive marketing automation platform that provides:
- **9 AI Agents** for different marketing tasks
- **Token-based billing** system with usage tracking
- **Campaign Management** to organize agent runs into projects
- **Analytics Dashboard** with charts and insights
- **Chat History** to review past agent interactions
- **Real-time updates** via Supabase realtime subscriptions

---

## ✨ Key Features

### 🤖 Agent Marketplace
- 10 specialized AI marketing agents
- Video preview modals with autoplay
- Agent descriptions and token costs
- Direct navigation to agent pages

### 💰 Token System
- User token balance tracking
- Per-agent token costs (some with multipliers)
- Usage logs with detailed history
- Token deduction on successful agent runs

### 📊 Campaign Management
- Create and organize campaigns
- Add multiple tasks per campaign
- Track campaign progress (Not Started, In Progress, Completed)
- View campaign artifacts and outputs
- Campaign-specific analytics

### 📈 Analytics Dashboard
- Token spend over time (line chart)
- Agent runs over time (line chart)
- Agent usage breakdown (pie chart)
- Token spend by agent (bar chart)
- Filterable usage history table

### 💬 Chat History
- Browse all past agent interactions
- Filter by agent, date range, and status
- View input/output summaries
- Navigate to campaigns from history

### 🎨 Modern UI
- Glassmorphism design
- Inline CSS styling (no external CSS files)
- Responsive layouts
- Dark theme throughout
- Lucide React icons

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Routing**: React Router DOM v6
- **Icons**: Lucide React
- **Charts**: Recharts
- **Styling**: Inline CSS with JavaScript objects
- **Automation**: n8n webhooks

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (recommended)
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Capstone-Ai-Marketplace

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# VITE_SUPABASE_URL=https://<your-project>.supabase.co
# VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Start development server
npm run dev
```

The app will open at `http://localhost:5173` (or next available port).

### Build for Production

```bash
# Build
npm run build

# Preview production build
npm run preview
```

---

## 🗄️ Database Setup

### Step 1: Run the Main SQL Setup

Execute `supabase-setup.sql` in your Supabase SQL Editor. This will:
- Create `agents` table with all 10 agents
- Create `profiles` table with token management
- Create `token_usage_log` for usage tracking
- Create `usage_logs` table for chat history
- Create `campaigns` and `campaign_tasks` tables
- Create `campaign_artifacts` for storing outputs
- Set up Row Level Security (RLS) policies
- Create necessary functions for token management

### Step 2: Verify Setup

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- `agents`
- `profiles`
- `token_usage_log`
- `usage_logs`
- `campaigns`
- `campaign_tasks`
- `campaign_artifacts`

### Step 3: Add Initial Token Balance

For testing, give yourself tokens:

```sql
UPDATE profiles 
SET tokens_remaining = 10000 
WHERE id = '<your-user-id>';
```

---

## 🤖 Available Agents

| Agent | Token Cost | Description |
|-------|-----------|-------------|
| **SEOrix** | 200 | SEO analysis and optimization recommendations |
| **LeadGen** | 150 | Intelligent lead generation from Google Maps |
| **WhatsPulse** | 50/contact | WhatsApp broadcast campaigns with CSV upload |
| **AdVisor** | 200 | AI-generated ad creatives with images |
| **SociaPlan** | 250 | 7-day social media content calendar |
| **EchoMind** | 150 | Audio sentiment analysis from call recordings |
| **TrendIQ** | 150/250 | Market trend analysis (location/keyword modes) |
| **Scriptly** | 300 | Viral video script generator for short-form content |
| **Adbrief** | 75 | Creative ad brief generator with multiple angles |
| **ClipGen** | 350 | Transform long-form videos into viral short-form clips |

---

## 📁 Project Structure

```
Capstone-Ai-Marketplace/
├── src/
│   ├── App.jsx                      # Main app with routing
│   ├── DashboardPage.jsx            # Agent marketplace + KPIs
│   ├── LoginPage.jsx                # Supabase authentication
│   ├── AnalyticsPage.jsx            # Charts and usage analytics
│   ├── CampaignsPage.jsx            # Campaign list and creation
│   ├── CampaignDetailPage.jsx       # Campaign detail with artifacts
│   ├── MyAgentsPage.jsx             # Agent usage history/chat history
│   │
│   ├── SEOrixPage.jsx               # SEO analysis agent
│   ├── LeadGenPage.jsx              # Lead generation agent
│   ├── WhatsPulsePage.jsx           # WhatsApp broadcast agent
│   ├── AdVisorPage.jsx              # Ad creative generator agent
│   ├── SociaPlanPage.jsx            # Social media calendar agent
│   ├── EchoMindPage.jsx             # Audio sentiment analysis agent
│   ├── TrendIQPage.jsx              # Market trends agent
│   ├── ScriptlyPage.jsx             # Video script generator agent
│   ├── AdbriefPage.jsx              # Ad brief generator agent
│   ├── ClipGenPage.jsx              # Viral clip generator agent
│   │
│   ├── components/
│   │   └── AdbriefPopup.jsx         # Popup for AdVisor integration
│   │
│   ├── services/
│   │   └── campaignService.js       # Campaign management functions
│   │
│   ├── utils/
│   │   ├── tokenService.js          # Token deduction logic
│   │   └── summaryGenerator.js      # Output summary generation
│   │
│   ├── main.jsx
│   ├── index.css
│   └── App.css
│
├── supabaseClient.js                # Supabase client configuration
├── supabase-setup.sql               # Complete database setup
├── package.json
├── vite.config.js
└── README.md
```

---

## 🔐 Environment Setup

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

These are accessed in `supabaseClient.js` via `import.meta.env`.

**Security Notes:**
- Never commit `.env.local` to version control
- Use anon key for frontend (not service role key)
- Configure RLS policies in Supabase for security

---

## 🎯 Feature Implementations

### Token Management System

**Token Deduction Flow:**
1. Frontend calls `executeWithTokens()` from `tokenService.js`
2. Checks user has sufficient tokens
3. Deducts tokens (with multipliers for WhatsPulse/TrendIQ)
4. Calls agent webhook
5. Logs usage in `token_usage_log` and `usage_logs`
6. Updates user token balance
7. Returns result with token info

**Multiplier Examples:**
- WhatsPulse: 50 tokens × number of contacts
- TrendIQ: 1 token × 150 (location) or × 250 (keyword)

### Campaign System

**Campaign Structure:**
```
Campaign
├── Name, Description, Status
├── Tasks (agent runs to complete)
│   ├── Task 1: SEOrix
│   ├── Task 2: AdVisor
│   └── Task 3: SociaPlan
└── Artifacts (outputs from completed tasks)
    ├── Artifact 1: SEO Report
    ├── Artifact 2: Ad Creative
    └── Artifact 3: Social Calendar
```

**Task Lifecycle:**
1. Create campaign with tasks
2. Navigate to agent from campaign detail
3. Agent receives `campaignId` via router state
4. On successful run, task marked complete
5. Output saved as campaign artifact
6. Navigate back to campaign detail

### Chat History

**Features:**
- Chronological list of all agent runs
- Agent name and icon display
- Input/output summaries (auto-generated)
- Status indicators (success/failed)
- Token cost display
- Date/time formatting
- Filterable by agent and date
- Campaign association (if run was part of a campaign)

### Analytics Dashboard

**Charts:**
1. **Token Spend Over Time** - Line chart showing daily token consumption
2. **Agent Runs Over Time** - Line chart showing daily agent usage
3. **Agent Usage by Runs** - Pie chart showing distribution of runs
4. **Token Spend by Agent** - Bar chart showing costs per agent

### Artifact Rendering

Each agent has custom rendering in `CampaignDetailPage.jsx`:
- **SEOrix**: Priority-based recommendations
- **LeadGen**: Lead cards with scores
- **SociaPlan**: Weekly calendar grid
- **EchoMind**: Sentiment analysis results
- **WhatsPulse**: Broadcast statistics
- **AdVisor**: Ad creative with image (+ error handling)
- **Scriptly**: Script variations with scenes
- **Adbrief**: Brief variations
- **TrendIQ**: Trend analysis (keyword/location modes)

**Data Format Handling:**
Supports multiple output formats:
- `[{output: {...}}]` - Newer n8n format
- `{output: {...}}` - Alternative wrapper
- `{...}` - Direct object (legacy)

---

## 🐛 Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Vite auto-increments port (5173 → 5174 → 5175)
# Or specify custom port:
npm run dev -- --port 3000
```

**2. Supabase Authentication Errors**
- Verify `.env.local` has correct URL and key
- Restart dev server after changing env vars
- Check Supabase project status

**3. Token Deduction Not Working**
- Verify `supabase-setup.sql` was executed completely
- Check RLS policies are enabled
- Ensure user has profile row

**4. Agent Webhook Timeouts**
- SEOrix: 10-minute timeout
- Others: 5-minute timeout
- Check n8n workflow is running
- Verify CORS configuration

**5. Images Not Loading**
- Check AdVisor imageUrl in output
- Verify image host allows cross-origin requests
- Placeholder shown for missing/failed images

**6. Campaign Artifacts Not Displaying**
- Check console logs for data structure
- Verify agent rendering case exists in `CampaignDetailPage.jsx`
- Ensure output_data format matches expected structure

### Database Issues

**Reset Token Balance:**
```sql
UPDATE profiles 
SET tokens_remaining = 5000 
WHERE email = 'your-email@example.com';
```

**View Usage Logs:**
```sql
SELECT agent_name, tokens_deducted, created_at 
FROM token_usage_log 
WHERE user_id = '<your-id>' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Check Campaign Status:**
```sql
SELECT c.name, c.status, COUNT(ct.id) as task_count
FROM campaigns c
LEFT JOIN campaign_tasks ct ON c.id = ct.campaign_id
WHERE c.user_id = '<your-id>'
GROUP BY c.id, c.name, c.status;
```

---

## 🔄 Recent Updates

### ✅ Artifact Display Fix
- Added TrendIQ rendering (was showing raw JSON)
- Fixed data unwrapping for all agents
- Added image error handling with placeholders
- Enhanced debugging with console logs
- Better error messages for missing formatters

### ✅ Analytics Improvements
- Split combined chart into two side-by-side graphs
- Separate "Token Spend" and "Agent Runs" visualizations
- Responsive grid layout

### ✅ UI Enhancements
- Removed default placeholder text from Scriptly form fields
- Improved campaign artifact cards styling
- Added loading states across all pages
- Better error handling and user feedback

### ✅ Database Updates
- Added Scriptly agent (300 tokens)
- Added Adbrief agent (75 tokens)
- All agents now in main SQL file

---

## 📄 License

This project is proprietary. All rights reserved.

---

**Made with ❤️ using React + Vite + Supabase**
