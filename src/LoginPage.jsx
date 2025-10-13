import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();

  // Check if the user is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/'); // Redirect to dashboard if already logged in
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/'); // Redirect to dashboard on successful login
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <div className="login-container">
      <h1 className="logo" style={{ fontSize: '3rem', marginBottom: '1rem' }}>MarketMuse AI</h1>
      <p style={{ color: 'rgba(240, 240, 240, 0.7)', marginBottom: '2rem' }}>The AI Marketing & Growth Suite</p>
      <button onClick={signInWithGoogle} className="btn btn-primary">Sign in with Google</button>
    </div>
  );
}

export default LoginPage;