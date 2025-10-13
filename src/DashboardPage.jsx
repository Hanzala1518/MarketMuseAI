import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [agents, setAgents] = useState([]);
  const [outputs, setOutputs] = useState({});
  const [loadingAgentId, setLoadingAgentId] = useState(null);

  // Effect #1: Manages the user session and fetches agents
  useEffect(() => {
    const fetchAgents = async () => {
      const { data, error } = await supabase.from('agents').select('*');
      if (error) console.error("Error fetching agents", error);
      else setAgents(data || []);
    };
    fetchAgents();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      } else {
        setSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Effect #2: Manages profile data and realtime updates
  useEffect(() => {
    if (session?.user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (error) console.error('Error fetching profile:', error);
        else setProfile(data);
      };
      fetchProfile();

      const profileListener = supabase
        .channel('public:profiles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
          setProfile(payload.new);
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(profileListener);
      };
    }
  }, [session]);

  const handleLaunchAgent = async (agentId) => {
    setLoadingAgentId(agentId);
    setOutputs(prev => ({ ...prev, [agentId]: 'Running agent...' }));

    const { data, error } = await supabase.rpc('run_agent', {
      agent_id_to_run: agentId
    });

    if (error) {
      setOutputs(prev => ({ ...prev, [agentId]: `Error: ${error.message}` }));
    } else {
      setOutputs(prev => ({ ...prev, [agentId]: JSON.stringify(data, null, 2) }));
    }
    setLoadingAgentId(null);
  };

  const displayName = profile?.full_name || session?.user?.email || '';
  
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (!session || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background-start-rgb)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">MarketMuse AI</div>
          <div className="user-info">
            <span>Welcome, {displayName}</span>
            <div className="token-display">
              {profile ? `${profile.tokens_remaining} Tokens` : 'Loading...'}
            </div>
            <button onClick={signOut} className="btn btn-secondary">Sign Out</button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <h2 className="dashboard-title">Agent Dashboard</h2>
        <div className="agent-grid">
          {agents.map((agent) => (
            <div key={agent.id} className="agent-card">
              <h3>
                {/* --- THIS SVG IS NOW CORRECTED --- */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                {agent.name}
              </h3>
              <p>{agent.description}</p>
              <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Cost: {agent.token_cost} Tokens</p>
              <button
                onClick={() => handleLaunchAgent(agent.id)}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={loadingAgentId === agent.id}
              >
                {loadingAgentId === agent.id ? 'Running...' : 'Launch Agent'}
              </button>
              {outputs[agent.id] && (
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <strong>Output:</strong>
                  <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '0.5rem' }}>{outputs[agent.id]}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;