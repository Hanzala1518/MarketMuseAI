import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  ArrowLeft, User, Mail, Shield, Trash2, AlertTriangle,
  Moon, Sun, CreditCard, Key
} from 'lucide-react';

function SettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true); // Always dark for now
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

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
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    try {
      // Note: Actual account deletion should be handled by Supabase Auth Admin API
      // This is a placeholder for the UI flow
      alert('Account deletion requested. This feature requires backend implementation.');
      
      // For now, just sign out
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please contact support.');
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
      maxWidth: '1000px',
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
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2rem'
    },
    section: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '2rem',
      marginBottom: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)'
    },
    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#e2e8f0'
    },
    profileGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem'
    },
    infoItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    label: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    value: {
      fontSize: '1rem',
      color: '#e2e8f0',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    toggleRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    toggleLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.95rem',
      color: '#e2e8f0'
    },
    toggle: {
      width: '50px',
      height: '28px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '14px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'all 0.3s'
    },
    toggleActive: {
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)'
    },
    toggleThumb: {
      width: '22px',
      height: '22px',
      background: '#fff',
      borderRadius: '50%',
      position: 'absolute',
      top: '3px',
      left: '3px',
      transition: 'all 0.3s'
    },
    toggleThumbActive: {
      left: '25px'
    },
    dangerSection: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    },
    warningBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1.5rem',
      display: 'flex',
      gap: '1rem'
    },
    warningText: {
      fontSize: '0.875rem',
      color: '#fca5a5',
      lineHeight: '1.6'
    },
    deleteButton: {
      background: 'rgba(239, 68, 68, 0.2)',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      borderRadius: '12px',
      padding: '0.75rem 1.5rem',
      color: '#fca5a5',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
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
      border: '1px solid rgba(239, 68, 68, 0.3)',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
    },
    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1.5rem'
    },
    modalTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#fca5a5'
    },
    modalText: {
      fontSize: '0.95rem',
      color: '#9ca3af',
      lineHeight: '1.6',
      marginBottom: '1.5rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '0.95rem',
      outline: 'none',
      marginBottom: '1.5rem'
    },
    modalActions: {
      display: 'flex',
      gap: '1rem'
    },
    confirmButton: {
      flex: 1,
      padding: '0.75rem',
      background: 'rgba(239, 68, 68, 0.2)',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      borderRadius: '12px',
      color: '#fca5a5',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s'
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
    comingSoon: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '1rem',
      textAlign: 'center',
      color: '#9ca3af',
      fontSize: '0.875rem',
      fontStyle: 'italic'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        .back-button:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateX(-4px);
        }
        .delete-button:hover {
          background: rgba(239, 68, 68, 0.3);
          transform: translateY(-2px);
        }
        .confirm-button:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .input:focus {
          border-color: rgba(239, 68, 68, 0.5);
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
            <Shield size={28} />
            Settings
          </div>
          <div style={{ width: '160px' }} />
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ width: '50px', height: '50px', border: '4px solid rgba(147,51,234,0.3)', borderTop: '4px solid #9333ea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
            <div style={{ color: '#9ca3af' }}>Loading settings...</div>
          </div>
        ) : (
          <>
            {/* Profile Section */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <User size={24} color="#9333ea" />
                Profile Information
              </div>
              <div style={styles.profileGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.label}>Full Name</div>
                  <div style={styles.value}>
                    {profile?.full_name || 'Not set'}
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.label}>Email Address</div>
                  <div style={styles.value}>
                    {session?.user?.email || 'Not available'}
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.label}>User ID</div>
                  <div style={styles.value} title={session?.user?.id}>
                    {session?.user?.id?.substring(0, 8)}...
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.label}>Tokens Remaining</div>
                  <div style={styles.value}>
                    {profile?.tokens_remaining?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Appearance Section */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <Moon size={24} color="#ec4899" />
                Appearance
              </div>
              <div style={styles.toggleRow}>
                <div style={styles.toggleLabel}>
                  <Moon size={20} />
                  Dark Mode
                </div>
                <div 
                  style={{...styles.toggle, ...(darkMode ? styles.toggleActive : {})}}
                  onClick={() => setDarkMode(!darkMode)}
                >
                  <div style={{...styles.toggleThumb, ...(darkMode ? styles.toggleThumbActive : {})}}></div>
                </div>
              </div>
              <div style={{ ...styles.comingSoon, marginTop: '1rem' }}>
                Light mode coming soon
              </div>
            </div>

            {/* Billing Section (Future) */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <CreditCard size={24} color="#10b981" />
                Billing & Tokens
              </div>
              <div style={styles.comingSoon}>
                Token purchase and billing features coming soon
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{...styles.section, ...styles.dangerSection}}>
              <div style={styles.sectionTitle}>
                <AlertTriangle size={24} color="#ef4444" />
                Danger Zone
              </div>
              <div style={styles.warningBox}>
                <AlertTriangle size={20} color="#fca5a5" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#fca5a5' }}>
                    Delete Account
                  </div>
                  <div style={styles.warningText}>
                    Once you delete your account, there is no going back. All your data, including campaigns, 
                    usage history, and tokens will be permanently deleted.
                  </div>
                </div>
              </div>
              <button 
                style={styles.deleteButton}
                onClick={() => setShowDeleteModal(true)}
                className="delete-button"
              >
                <Trash2 size={18} />
                Delete My Account
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={styles.modal} onClick={() => setShowDeleteModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <AlertTriangle size={28} color="#ef4444" />
              <div style={styles.modalTitle}>Delete Account</div>
            </div>
            <div style={styles.modalText}>
              This action cannot be undone. This will permanently delete your account, 
              all your campaigns, usage history, and any remaining tokens.
            </div>
            <div style={styles.modalText}>
              Please type <strong style={{ color: '#fca5a5' }}>DELETE</strong> to confirm:
            </div>
            <input
              type="text"
              style={styles.input}
              className="input"
              placeholder="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <div style={styles.modalActions}>
              <button 
                style={styles.cancelButton}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                style={styles.confirmButton}
                onClick={handleDeleteAccount}
                className="confirm-button"
                disabled={deleteConfirm !== 'DELETE'}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
