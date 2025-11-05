import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, Filter, Search, Calendar,
  Zap, TrendingUp, Download, MessageSquare, ChevronRight, Eye, Info
} from 'lucide-react';

function MyAgentsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [usageLogs, setUsageLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, success, error
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [selectedLog, setSelectedLog] = useState(null); // For viewing details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
      fetchUsageLogs();
    }
  }, [session]);

  const fetchUsageLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('ran_at', { ascending: false });
      
      if (error) throw error;
      
      setUsageLogs(data || []);
      setFilteredLogs(data || []);
    } catch (error) {
      console.error('Error fetching usage logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    filterLogs();
  }, [searchTerm, statusFilter, dateFilter, usageLogs]);

  const filterLogs = () => {
    let filtered = [...usageLogs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.agent_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      if (dateFilter === 'today') {
        filterDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'week') {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === 'month') {
        filterDate.setMonth(now.getMonth() - 1);
      }
      
      filtered = filtered.filter(log => new Date(log.ran_at) >= filterDate);
    }

    setFilteredLogs(filtered);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatFullDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Generate a meaningful title from agent name and input data
  const generateTitle = (log) => {
    if (log.output_summary) return log.output_summary;
    
    const agentName = log.agent_name;
    const inputData = log.input_data;
    
    if (!inputData) return `${agentName} Run`;
    
    // Generate titles based on agent type and input
    switch(agentName) {
      case 'TrendIQ':
        if (inputData.keyword) return `Analyzed "${inputData.keyword}" trends`;
        if (inputData.city) return `Explored trends in ${inputData.city}`;
        return 'Trend Analysis';
      
      case 'SEOrix':
        if (inputData.url) {
          const domain = inputData.url.replace(/^https?:\/\//i, '').split('/')[0];
          return `SEO audit for ${domain}`;
        }
        return 'SEO Analysis';
      
      case 'AdVisor':
        if (inputData.platform) return `${inputData.platform} ad campaign`;
        return 'Ad Campaign';
      
      case 'EchoMind':
        if (inputData.prompt) {
          const shortPrompt = inputData.prompt.slice(0, 40);
          return shortPrompt.length < inputData.prompt.length ? `${shortPrompt}...` : shortPrompt;
        }
        return 'Chat Conversation';
      
      case 'SociaPlan':
        if (inputData.topic) return `Social posts about ${inputData.topic}`;
        return 'Content Planning';
      
      case 'WhatsPulse':
        if (inputData.contactCount) return `Campaign to ${inputData.contactCount} contacts`;
        return 'WhatsApp Campaign';
      
      case 'LeadGen':
        if (inputData.industry) return `Leads in ${inputData.industry}`;
        return 'Lead Generation';
      
      default:
        return `${agentName} Run`;
    }
  };

  const getTotalStats = () => {
    const successLogs = filteredLogs.filter(log => log.status === 'success');
    const totalTokens = successLogs.reduce((sum, log) => sum + (log.tokens_spent || 0), 0);
    const totalRuns = successLogs.length;
    const errorRuns = filteredLogs.filter(log => log.status === 'error').length;
    
    return { totalTokens, totalRuns, errorRuns };
  };

  const stats = getTotalStats();

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
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem'
    },
    statCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '0.5rem'
    },
    statLabel: {
      fontSize: '0.875rem',
      color: '#9ca3af'
    },
    filterSection: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)'
    },
    filterRow: {
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchBox: {
      flex: '1',
      minWidth: '250px',
      position: 'relative'
    },
    searchInput: {
      width: '100%',
      padding: '0.75rem 1rem 0.75rem 2.5rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      outline: 'none'
    },
    searchIcon: {
      position: 'absolute',
      left: '0.75rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af'
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
    tableContainer: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden'
    },
    cardsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '1.5rem',
      padding: '1.5rem'
    },
    historyCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      cursor: 'pointer',
      transition: 'all 0.3s',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.08)',
        transform: 'translateY(-2px)',
        borderColor: 'rgba(147,51,234,0.3)'
      }
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    cardHeaderLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    cardHeaderRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    agentBadge: {
      padding: '0.25rem 0.75rem',
      background: 'rgba(147,51,234,0.2)',
      color: '#c084fc',
      borderRadius: '8px',
      fontSize: '0.85rem',
      fontWeight: '600'
    },
    dateText: {
      fontSize: '0.875rem',
      color: '#9ca3af'
    },
    cardTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      color: '#fff',
      marginBottom: '0.75rem',
      lineHeight: '1.4'
    },
    cardSummary: {
      fontSize: '0.95rem',
      color: '#d1d5db',
      lineHeight: '1.6',
      marginBottom: '1rem',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    },
    cardSummaryPlaceholder: {
      fontSize: '0.95rem',
      color: '#6b7280',
      fontStyle: 'italic',
      marginBottom: '1rem'
    },
    cardFooter: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '0.75rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    tokensBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.35rem 0.75rem',
      background: 'rgba(236,72,153,0.1)',
      borderRadius: '8px',
      fontSize: '0.875rem',
      color: '#ec4899',
      fontWeight: '600'
    },
    viewDetailsBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      fontSize: '0.875rem',
      color: '#9ca3af',
      fontWeight: '500'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    },
    modalContent: {
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16001e 100%)',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
    },
    modalHeader: {
      padding: '1.5rem 2rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      background: 'inherit',
      zIndex: 1
    },
    modalTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    modalCloseBtn: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '1.5rem',
      color: '#9ca3af',
      transition: 'all 0.3s'
    },
    modalBody: {
      padding: '2rem'
    },
    detailSection: {
      marginBottom: '1.5rem'
    },
    detailLabel: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem'
    },
    detailValue: {
      fontSize: '1rem',
      color: '#e2e8f0',
      lineHeight: '1.6'
    },
    codeBlock: {
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '12px',
      padding: '1rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      maxHeight: '300px',
      overflow: 'auto'
    },
    codeContent: {
      margin: 0,
      fontSize: '0.875rem',
      color: '#d1d5db',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    tableHeader: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    th: {
      padding: '1rem 1.5rem',
      textAlign: 'left',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    td: {
      padding: '1rem 1.5rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      fontSize: '0.95rem'
    },
    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.35rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '600'
    },
    successBadge: {
      background: 'rgba(34,197,94,0.2)',
      color: '#86efac',
      border: '1px solid rgba(34,197,94,0.3)'
    },
    errorBadge: {
      background: 'rgba(239,68,68,0.2)',
      color: '#fca5a5',
      border: '1px solid rgba(239,68,68,0.3)'
    },
    agentName: {
      fontWeight: '600',
      color: '#e2e8f0'
    },
    tokensCell: {
      fontWeight: '600',
      color: '#c084fc'
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
        .search-input:focus {
          border-color: rgba(147,51,234,0.5);
        }
        .history-card:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          transform: translateY(-2px);
          border-color: rgba(147,51,234,0.3);
          box-shadow: 0 8px 24px rgba(147,51,234,0.2);
        }
        .history-card:hover .viewDetailsBtn {
          color: #c084fc;
        }
        tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
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
            <Clock size={28} />
            My Agents Activity
          </div>
          <div style={{ width: '160px' }} />
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalRuns}</div>
            <div style={styles.statLabel}>Successful Runs</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalTokens.toLocaleString()}</div>
            <div style={styles.statLabel}>Tokens Spent</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.errorRuns}</div>
            <div style={styles.statLabel}>Failed Runs</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{filteredLogs.length}</div>
            <div style={styles.statLabel}>Total Entries</div>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filterSection}>
          <div style={styles.filterRow}>
            <div style={styles.searchBox}>
              <Search size={18} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by agent name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
                className="search-input"
              />
            </div>
            
            <button
              style={{...styles.filterButton, ...(statusFilter === 'all' ? styles.filterButtonActive : {})}}
              onClick={() => setStatusFilter('all')}
              className="filter-button"
            >
              All Status
            </button>
            <button
              style={{...styles.filterButton, ...(statusFilter === 'success' ? styles.filterButtonActive : {})}}
              onClick={() => setStatusFilter('success')}
              className="filter-button"
            >
              Success
            </button>
            <button
              style={{...styles.filterButton, ...(statusFilter === 'error' ? styles.filterButtonActive : {})}}
              onClick={() => setStatusFilter('error')}
              className="filter-button"
            >
              Error
            </button>
            
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
            
            <button
              style={{...styles.filterButton, ...(dateFilter === 'all' ? styles.filterButtonActive : {})}}
              onClick={() => setDateFilter('all')}
              className="filter-button"
            >
              All Time
            </button>
            <button
              style={{...styles.filterButton, ...(dateFilter === 'today' ? styles.filterButtonActive : {})}}
              onClick={() => setDateFilter('today')}
              className="filter-button"
            >
              Today
            </button>
            <button
              style={{...styles.filterButton, ...(dateFilter === 'week' ? styles.filterButtonActive : {})}}
              onClick={() => setDateFilter('week')}
              className="filter-button"
            >
              This Week
            </button>
            <button
              style={{...styles.filterButton, ...(dateFilter === 'month' ? styles.filterButtonActive : {})}}
              onClick={() => setDateFilter('month')}
              className="filter-button"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Activity History Cards */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.emptyState}>
              <div style={{...styles.emptyIcon, animation: 'spin 1s linear infinite', border: '4px solid rgba(147,51,234,0.3)', borderTop: '4px solid #9333ea', borderRadius: '50%', width: '50px', height: '50px', margin: '2rem auto'}}></div>
              <div>Loading your activity...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <Clock size={40} color="#9ca3af" />
              </div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>No activity found</h3>
              <p>Start using agents to see your activity history here.</p>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  style={styles.historyCard}
                  className="history-card"
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetailsModal(true);
                  }}
                >
                  {/* Header Row */}
                  <div style={styles.cardHeader}>
                    <div style={styles.cardHeaderLeft}>
                      <MessageSquare size={18} color="#c084fc" />
                      <span style={styles.agentBadge}>{log.agent_name}</span>
                    </div>
                    <div style={styles.cardHeaderRight}>
                      <span style={styles.dateText}>{formatDate(log.ran_at)}</span>
                      {log.status === 'success' ? (
                        <CheckCircle size={18} color="#10b981" />
                      ) : (
                        <XCircle size={18} color="#ef4444" />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 style={styles.cardTitle}>{generateTitle(log)}</h3>

                  {/* Summary or Placeholder */}
                  {log.output_summary ? (
                    <p style={styles.cardSummary}>{log.output_summary}</p>
                  ) : (
                    <p style={styles.cardSummaryPlaceholder}>
                      {log.status === 'success' 
                        ? 'Task completed successfully' 
                        : 'Task encountered an error'}
                    </p>
                  )}

                  {/* Footer Row */}
                  <div style={styles.cardFooter}>
                    <div style={styles.tokensBadge}>
                      <Zap size={14} />
                      <span>{log.tokens_spent} tokens</span>
                    </div>
                    <div style={styles.viewDetailsBtn}>
                      <span>View Details</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedLog && (
        <div style={styles.modalOverlay} onClick={() => setShowDetailsModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Run Details</h2>
              <button 
                style={styles.modalCloseBtn}
                onClick={() => setShowDetailsModal(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Agent & Status */}
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Agent</div>
                <div style={styles.detailValue}>
                  <span style={styles.agentBadge}>{selectedLog.agent_name}</span>
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Status</div>
                <div style={styles.detailValue}>
                  {selectedLog.status === 'success' ? (
                    <span style={{...styles.statusBadge, background: 'rgba(16,185,129,0.1)', color: '#10b981', gap: '0.5rem'}}>
                      <CheckCircle size={16} />
                      Success
                    </span>
                  ) : (
                    <span style={{...styles.statusBadge, background: 'rgba(239,68,68,0.1)', color: '#ef4444', gap: '0.5rem'}}>
                      <XCircle size={16} />
                      Error
                    </span>
                  )}
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Date & Time</div>
                <div style={styles.detailValue}>{formatFullDate(selectedLog.ran_at)}</div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Tokens Spent</div>
                <div style={styles.detailValue}>
                  <span style={styles.tokensBadge}>
                    <Zap size={14} />
                    {selectedLog.tokens_spent} tokens
                  </span>
                </div>
              </div>

              {/* Input Data */}
              {selectedLog.input_data && (
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Input Parameters</div>
                  <div style={styles.codeBlock}>
                    <pre style={styles.codeContent}>
                      {JSON.stringify(selectedLog.input_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Output Summary */}
              {selectedLog.output_summary && (
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Summary</div>
                  <div style={styles.detailValue}>{selectedLog.output_summary}</div>
                </div>
              )}

              {/* Full Output Data */}
              {selectedLog.output_data && (
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Full Output</div>
                  <div style={styles.codeBlock}>
                    <pre style={styles.codeContent}>
                      {JSON.stringify(selectedLog.output_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAgentsPage;
