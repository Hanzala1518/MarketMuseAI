import { Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage.jsx' // <-- Added .jsx extension
import DashboardPage from './DashboardPage.jsx' // <-- Added .jsx extension
import SEOrixPage from './SEOrixPage.jsx'
import LeadGenPage from './LeadGenPage.jsx'
import AdVisorPage from './AdVisorPage.jsx'
import WhatsPulsePage from './WhatsPulsePage.jsx'
import EchoMindPage from './EchoMindPage.jsx'
import SociaPlanPage from './SociaPlanPage.jsx'
import TrendIQPage from './TrendIQPage.jsx'
import ScriptlyPage from './ScriptlyPage.jsx'
import AdbriefPage from './AdbriefPage.jsx'
import ClipGenPage from './ClipGenPage.jsx'
import MyAgentsPage from './MyAgentsPage.jsx'
import AnalyticsPage from './AnalyticsPage.jsx'
import CampaignsPage from './CampaignsPage.jsx'
import CampaignDetailPage from './CampaignDetailPage.jsx'
import SettingsPage from './SettingsPage.jsx'

import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/seorix" element={<SEOrixPage />} />
      <Route path="/leadgen" element={<LeadGenPage />} />
      <Route path="/advisor" element={<AdVisorPage />} />
      <Route path="/whatspulse" element={<WhatsPulsePage />} />
      <Route path="/echomind" element={<EchoMindPage />} />
      <Route path="/sociaplan" element={<SociaPlanPage />} />
      <Route path="/trendiq" element={<TrendIQPage />} />
      <Route path="/scriptly" element={<ScriptlyPage />} />
      <Route path="/adbrief" element={<AdbriefPage />} />
      <Route path="/clipgen" element={<ClipGenPage />} />
      <Route path="/my-agents" element={<MyAgentsPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/campaigns" element={<CampaignsPage />} />
      <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App