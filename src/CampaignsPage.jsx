import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getCampaignsWithStats, deleteCampaign, updateCampaign } from './services/campaignService';
import { Plus, Folder, ChevronDown, Search, Filter, Trash2, Edit, Play, Pause, CheckCircle, MoreVertical, ArrowLeft, FolderOpen } from 'lucide-react';
import CreateCampaignModal from './CreateCampaignModal';

const CampaignsPage = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDropdown, setShowDropdown] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/login');
      return;
    }

    const result = await getCampaignsWithStats(session.user.id);
    if (result.success) {
      setCampaigns(result.campaigns);
    }
    setLoading(false);
  };

  const handleCreateCampaign = () => {
    setShowCreateModal(true);
  };

  const handleCampaignCreated = () => {
    loadCampaigns();
    setShowCreateModal(false);
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign? All associated data will be lost.')) {
      return;
    }

    const result = await deleteCampaign(campaignId);
    if (result.success) {
      loadCampaigns();
    }
  };

  const handleStatusChange = async (campaignId, newStatus) => {
    const result = await updateCampaign(campaignId, { status: newStatus });
    if (result.success) {
      loadCampaigns();
    }
    setShowDropdown(null);
  };

  const handleCampaignClick = (campaignId) => {
    navigate(`/campaigns/${campaignId}`);
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return { color: '#10b981', text: 'Active', dot: '#10b981' };
      case 'Paused': return { color: '#d97706', text: 'Paused', dot: '#d97706' };
      case 'Completed': return { color: '#ef4444', text: 'Completed', dot: '#ef4444' };
      default: return { color: '#64748b', text: status, dot: '#64748b' };
    }
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
    createButton: {
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '0.75rem 1.5rem',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.95rem',
      fontWeight: '600',
      transition: 'all 0.3s',
      boxShadow: '0 4px 12px rgba(147,51,234,0.4)'
    },
    mainContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem'
    },
    campaignsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '1.5rem'
    },
    campaignCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      transition: 'all 0.3s',
      cursor: 'pointer'
    },
    colorBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      borderRadius: '16px 16px 0 0'
    },
    campaignHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1rem',
      gap: '1rem',
      position: 'relative'
    },
    campaignName: {
      fontSize: '1.4rem',
      fontWeight: '700',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 50%, #fbbf24 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '0.5rem',
      letterSpacing: '0.02em'
    },
    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.35rem 0.85rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)'
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%'
    },
    campaignDescription: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      marginBottom: '1.5rem',
      lineHeight: '1.6'
    },
    actionButtons: {
      display: 'flex',
      gap: '0.5rem',
      position: 'relative',
      zIndex: 10
    },
    iconButton: {
      background: 'rgba(30, 30, 45, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s',
      color: '#e2e8f0',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      flexShrink: 0
    },
    progressSection: {
      marginBottom: '1.5rem'
    },
    progressInfo: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '0.5rem',
      fontSize: '0.85rem',
      color: '#9ca3af',
      fontWeight: '500'
    },
    progressBar: {
      width: '100%',
      height: '8px',
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, #9333ea 0%, #ec4899 100%)',
      borderRadius: '10px',
      transition: 'width 0.3s ease'
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '0.5rem',
      background: 'rgba(20, 20, 30, 0.98)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      padding: '0.5rem',
      minWidth: '160px',
      zIndex: 10,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(16px)'
    },
    dropdownItem: {
      padding: '0.65rem 0.85rem',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      fontSize: '0.875rem',
      color: '#e2e8f0',
      fontWeight: '500'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1rem',
      paddingTop: '1rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    stat: {
      textAlign: 'center'
    },
    statValue: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#c084fc',
      marginBottom: '0.25rem'
    },
    statLabel: {
      fontSize: '0.75rem',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    },
    modalContent: {
      background: 'linear-gradient(135deg, #1a0a2e 0%, #16001e 100%)',
      borderRadius: '20px',
      padding: '2rem',
      maxWidth: '500px',
      width: '100%',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem'
    },
    modalTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#e2e8f0'
    },
    closeButton: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '8px',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#fff',
      transition: 'all 0.3s'
    },
    formGroup: {
      marginBottom: '1.5rem'
    },
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#9ca3af'
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      outline: 'none',
      transition: 'all 0.3s'
    },
    textarea: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      outline: 'none',
      resize: 'vertical',
      minHeight: '100px',
      transition: 'all 0.3s',
      fontFamily: 'inherit'
    },
    colorOptions: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '0.75rem'
    },
    colorOption: {
      width: '100%',
      height: '50px',
      borderRadius: '12px',
      border: '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.3s',
      position: 'relative'
    },
    colorOptionSelected: {
      border: '2px solid #fff',
      transform: 'scale(1.05)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    },
    modalActions: {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem'
    },
    saveButton: {
      flex: 1,
      padding: '0.75rem',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      border: 'none',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem'
    },
    cancelButton: {
      flex: 1,
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s'
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
        .create-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(147,51,234,0.6);
        }
        .campaign-card:hover {
          transform: translateY(-4px);
          border-color: rgba(192, 132, 252, 0.3);
          box-shadow: 0 12px 32px rgba(147, 51, 234, 0.2);
        }
        .icon-button:hover {
          transform: scale(1.1);
        }
        .icon-button.delete:hover {
          background: #b91c1c !important;
          border-color: #dc2626 !important;
          transform: scale(1.15);
          box-shadow: 0 6px 16px rgba(220, 38, 38, 0.6) !important;
        }
        .icon-button.more:hover {
          background: rgba(148, 163, 184, 0.3) !important;
          border-color: rgba(148, 163, 184, 0.5) !important;
          color: #cbd5e1 !important;
          transform: scale(1.1);
        }
        .input:focus, .textarea:focus {
          border-color: rgba(147,51,234,0.5);
        }
        .close-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .save-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(147,51,234,0.6);
        }
        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
            <FolderOpen size={28} />
            Campaigns
          </div>
          <button 
            style={styles.createButton}
            onClick={handleCreateCampaign}
            className="create-button"
          >
            <Plus size={20} />
            New Campaign
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={{...styles.emptyIcon, animation: 'spin 1s linear infinite', border: '4px solid rgba(147,51,234,0.3)', borderTop: '4px solid #9333ea', borderRadius: '50%', width: '50px', height: '50px', margin: '2rem auto'}}></div>
            <div>Loading campaigns...</div>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <FolderOpen size={40} color="#9ca3af" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>No campaigns yet</h3>
            <p style={{ marginBottom: '2rem' }}>Create your first campaign to organize your agent runs.</p>
            <button 
              style={styles.createButton}
              onClick={handleCreateCampaign}
              className="create-button"
            >
              <Plus size={20} />
              Create Campaign
            </button>
          </div>
        ) : (
          <div style={styles.campaignsGrid}>
            {filteredCampaigns.map((campaign) => {
              const statusInfo = getStatusColor(campaign.status);
              return (
                <div 
                  key={campaign.id} 
                  style={styles.campaignCard} 
                  className="campaign-card"
                  onClick={() => handleCampaignClick(campaign.id)}
                >
                  <div style={styles.campaignHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.campaignName}>{campaign.name}</div>
                      <div style={styles.statusBadge}>
                        <span style={{ ...styles.statusDot, background: statusInfo.dot }}></span>
                        <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
                      </div>
                    </div>
                    <div style={styles.actionButtons} onClick={(e) => e.stopPropagation()}>
                      <button 
                        style={{
                          ...styles.iconButton, 
                          background: '#ef4444',
                          border: '2px solid #ff6b6b',
                          color: '#ffffff',
                          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.8)',
                          opacity: 1
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(campaign.id);
                        }}
                        className="icon-button delete"
                        title="Delete campaign"
                      >
                        <Trash2 size={20} strokeWidth={3} />
                      </button>
                      <button 
                        style={{
                          ...styles.iconButton,
                          background: '#64748b',
                          border: '2px solid #94a3b8',
                          color: '#ffffff',
                          boxShadow: '0 4px 16px rgba(100, 116, 139, 0.6)',
                          opacity: 1
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDropdown(showDropdown === campaign.id ? null : campaign.id);
                        }}
                        className="icon-button more"
                        title="More options"
                      >
                        <MoreVertical size={20} strokeWidth={3} />
                      </button>
                      {showDropdown === campaign.id && (
                        <div style={styles.dropdown}>
                          <div 
                            style={styles.dropdownItem} 
                            onClick={() => handleStatusChange(campaign.id, 'Active')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(147, 51, 234, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Play size={14} /> Active
                          </div>
                          <div 
                            style={styles.dropdownItem} 
                            onClick={() => handleStatusChange(campaign.id, 'Paused')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Pause size={14} /> Paused
                          </div>
                          <div 
                            style={styles.dropdownItem} 
                            onClick={() => handleStatusChange(campaign.id, 'Completed')}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <CheckCircle size={14} /> Completed
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {campaign.description && (
                    <div style={styles.campaignDescription}>{campaign.description}</div>
                  )}
                  
                  <div style={styles.progressSection}>
                    <div style={styles.progressInfo}>
                      <span>Progress</span>
                      <span style={{ color: '#c084fc', fontWeight: '600' }}>{campaign.progress_percentage || 0}%</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div 
                        style={{
                          ...styles.progressFill,
                          width: `${campaign.progress_percentage || 0}%`
                        }}
                      />
                    </div>
                  </div>
                  
                  <div style={styles.statsGrid}>
                    <div style={styles.stat}>
                      <div style={styles.statValue}>{campaign.total_tasks || 0}</div>
                      <div style={styles.statLabel}>Tasks</div>
                    </div>
                    <div style={styles.stat}>
                      <div style={styles.statValue}>{campaign.completed_tasks || 0}</div>
                      <div style={styles.statLabel}>Completed</div>
                    </div>
                    <div style={styles.stat}>
                      <div style={styles.statValue}>
                        {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : '-'}
                      </div>
                      <div style={styles.statLabel}>Created</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCampaignCreated}
        />
      )}
    </div>
  );
}

export default CampaignsPage;
