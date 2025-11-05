import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  ArrowLeft, TrendingUp, BarChart3, PieChart, Calendar, Zap, Activity
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function AnalyticsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [timeRange, setTimeRange] = useState(30); // days

  const COLORS = ['#9333ea', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setSession(session);
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      fetchAnalytics();
    }
  }, [session, timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - timeRange);

      // Fetch usage logs
      const { data: logs, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'success')
        .gte('ran_at', startDate.toISOString())
        .order('ran_at', { ascending: true });
      
      if (error) throw error;

      // Process daily data
      const dailyMap = {};
      const agentMap = {};

      logs.forEach(log => {
        const date = new Date(log.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Daily aggregation
        if (!dailyMap[date]) {
          dailyMap[date] = { date, tokens: 0, runs: 0 };
        }
        dailyMap[date].tokens += log.tokens_spent || 0;
        dailyMap[date].runs += 1;

        // Agent aggregation
        if (!agentMap[log.agent_name]) {
          agentMap[log.agent_name] = { name: log.agent_name, runs: 0, tokens: 0 };
        }
        agentMap[log.agent_name].runs += 1;
        agentMap[log.agent_name].tokens += log.tokens_spent || 0;
      });

      setDailyData(Object.values(dailyMap));
      setAgentData(Object.values(agentMap).sort((a, b) => b.runs - a.runs));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(10, 10, 15, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '1rem',
          backdropFilter: 'blur(20px)'
        }}>
          <p style={{ color: '#e2e8f0', marginBottom: '0.5rem', fontWeight: '600' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, fontSize: '0.9rem' }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #16001e 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif'
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(12px)',
      background: 'rgba(255, 255, 255, 0.1)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      padding: '1.5rem 2rem'
    },
    headerContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    backButton: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '12px',
      padding: '0.75rem 1.5rem',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.95rem',
      fontWeight: '500',
      transition: 'all 0.3s'
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    mainContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem'
    },
    filterSection: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '2rem',
      justifyContent: 'flex-end'
    },
    filterButton: {
      padding: '0.75rem 1.25rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      cursor: 'pointer',
      transition: 'all 0.3s'
    },
    filterButtonActive: {
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      border: '1px solid rgba(147,51,234,0.5)'
    },
    chartContainer: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '2rem',
      marginBottom: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)'
    },
    chartTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#e2e8f0'
    },
    chartsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
      gap: '2rem',
      marginBottom: '2rem'
    },
    emptyState: {
      textAlign: 'center',
      padding: '4rem 2rem',
      color: '#9ca3af'
    },
    emptyIcon: {
      width: '80px',
      height: '80px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1.5rem'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        .back-button:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateX(-4px);
        }
        .filter-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <button 
            style={styles.backButton}
            onClick={() => navigate('/')}
            className="back-button"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <div style={styles.title}>
            <BarChart3 size={28} />
            Analytics Dashboard
          </div>
          <div style={{ width: '160px' }} />
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Time Range Filter */}
        <div style={styles.filterSection}>
          <button
            style={{...styles.filterButton, ...(timeRange === 7 ? styles.filterButtonActive : {})}}
            onClick={() => setTimeRange(7)}
            className="filter-button"
          >
            Last 7 Days
          </button>
          <button
            style={{...styles.filterButton, ...(timeRange === 30 ? styles.filterButtonActive : {})}}
            onClick={() => setTimeRange(30)}
            className="filter-button"
          >
            Last 30 Days
          </button>
          <button
            style={{...styles.filterButton, ...(timeRange === 90 ? styles.filterButtonActive : {})}}
            onClick={() => setTimeRange(90)}
            className="filter-button"
          >
            Last 90 Days
          </button>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            <div style={{...styles.emptyIcon, animation: 'spin 1s linear infinite', border: '4px solid rgba(147,51,234,0.3)', borderTop: '4px solid #9333ea', borderRadius: '50%', width: '50px', height: '50px', margin: '2rem auto'}}></div>
            <div>Loading analytics...</div>
          </div>
        ) : dailyData.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <BarChart3 size={40} color="#9ca3af" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>No data yet</h3>
            <p>Start using agents to see your analytics here.</p>
          </div>
        ) : (
          <>
            {/* Token Spend & Agent Runs Over Time - Side by Side */}
            <div style={styles.chartsGrid}>
              {/* Token Spend Over Time */}
              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>
                  <TrendingUp size={24} color="#9333ea" />
                  Token Spend Over Time
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.875rem' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.875rem' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tokens" 
                      stroke="#9333ea" 
                      strokeWidth={3}
                      dot={{ fill: '#9333ea', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Tokens Spent"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Agent Runs Over Time */}
              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>
                  <Activity size={24} color="#ec4899" />
                  Agent Runs Over Time
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.875rem' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.875rem' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="runs" 
                      stroke="#ec4899" 
                      strokeWidth={3}
                      dot={{ fill: '#ec4899', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Agent Runs"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Agent Usage Breakdown */}
            <div style={styles.chartsGrid}>
              {/* Pie Chart */}
              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>
                  <PieChart size={24} color="#ec4899" />
                  Agent Usage by Runs
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <RePieChart>
                    <Pie
                      data={agentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="runs"
                    >
                      {agentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>
                  <BarChart3 size={24} color="#10b981" />
                  Token Spend by Agent
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={agentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.75rem' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '0.875rem' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tokens" fill="#10b981" radius={[8, 8, 0, 0]} name="Tokens Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;
