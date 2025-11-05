import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, MessageCircle, Image, Target, Key, Phone, Headphones, TrendingUp, FileText, Users, Zap, BarChart3, Sparkles, Clock, Play, X } from 'lucide-react';
import * as THREE from 'three';

function LoginPage() {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        console.log('Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session check error:', error);
          return;
        }
        if (session) {
          console.log('Session found:', session.user.email);
          console.log('Redirecting to dashboard...');
          setTimeout(() => navigate('/'), 100); // Small delay to ensure navigation
        } else {
          console.log('No existing session found');
        }
      } catch (err) {
        console.error('Failed to check session:', err);
      }
    };
    checkSession();

    // Listen for auth changes (handles OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event);
      console.log('Session:', session ? session.user.email : 'null');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('User signed in successfully!');
        console.log('Navigating to dashboard...');
        setTimeout(() => navigate('/'), 100); // Small delay to ensure navigation
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    return () => {
      console.log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [navigate]);

  // WebGL Wave Particle Effect
  useEffect(() => {
    if (!canvasRef.current) return;

    const SEPARATION = 20;
    const AMOUNTX = 180;
    const AMOUNTY = 120;
    const PARTICLE_COUNT = AMOUNTX * AMOUNTY;

    let container, camera, scene, renderer;
    let particles, count = 0;
    let introProgress = 0;
    const introSpeed = 0.01;
    let animationFrameId;
    let scrollY = 0;
    const initialPositions = new Float32Array(PARTICLE_COUNT * 3);

    const vertexShader = `
      attribute float scale;
      attribute float shapeType;
      varying float vShapeType;
      void main() {
        vShapeType = shapeType;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = scale * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform vec3 color;
      uniform float opacity;
      varying float vShapeType;
      void main() {
        // Brand colors: purple (#9333ea) and pink (#ec4899)
        vec3 purple = vec3(0.576, 0.2, 0.918);
        vec3 pink = vec3(0.925, 0.282, 0.6);
        vec3 glowColor = mix(purple, pink, gl_PointCoord.x);
        
        if (vShapeType < 0.5) {
          // Circle with glow
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 finalColor = mix(color, glowColor, glow * 0.6);
          gl_FragColor = vec4(finalColor, alpha * opacity);
        } else {
          // Rectangle with gradient
          vec3 finalColor = mix(color, glowColor, 0.4);
          gl_FragColor = vec4(finalColor, opacity);
        }
      }
    `;

    function init() {
      container = canvasRef.current;
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
      camera.position.z = 1500;
      camera.position.y = 800; // Keep camera centered
      camera.position.x = 0.15;
      scene = new THREE.Scene();

      const numParticles = PARTICLE_COUNT;
      const positions = new Float32Array(numParticles * 3);
      const scales = new Float32Array(numParticles);
      const shapeTypes = new Float32Array(numParticles);

      let i = 0, j = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const x = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
          const y = -800; // Move particles way down below all hero content
          const z = (iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2)) + 200;// Push much further back
          
          positions[i] = x;
          positions[i + 1] = y;
          positions[i + 2] = z;
          
          // Store initial positions for scatter effect
          initialPositions[i] = x;
          initialPositions[i + 1] = y;
          initialPositions[i + 2] = z;
          
          scales[j] = 1;
          shapeTypes[j] = Math.random() > 0.5 ? 1.0 : 0.0; // Mix of circles and rectangles
          i += 3;
          j++;
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
      geometry.setAttribute('shapeType', new THREE.BufferAttribute(shapeTypes, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffffff) },
          opacity: { value: 0.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true
      });

      particles = new THREE.Points(geometry, material);
      scene.add(particles);

      renderer = new THREE.WebGLRenderer({ canvas: container, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      window.addEventListener('resize', onWindowResize);
      window.addEventListener('scroll', onScroll);
    }

    function onScroll() {
      scrollY = window.scrollY;
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      render();
    }

    function render() {
      // Calculate scroll progress (0 to 1, scatter effect over 800px of scroll)
      const scrollProgress = Math.min(scrollY / 800, 1);
      const fadeMultiplier = 1 - (scrollProgress * scrollProgress); // Quadratic fade for smoother transition
      
      // Intro animation
      if (introProgress < 1) {
        introProgress += introSpeed;
        const eased = easeOutCubic(Math.min(introProgress, 1));
        camera.position.z = 1500 - (1000 * eased);
        particles.material.uniforms.opacity.value = eased * 0.6 * fadeMultiplier;
      } else {
        // Pulse opacity after intro, affected by scroll
        const pulse = Math.sin(count * 0.02) * 0.15 + 0.65;
        particles.material.uniforms.opacity.value = pulse * fadeMultiplier;
      }

      const positions = particles.geometry.attributes.position.array;
      const scales = particles.geometry.attributes.scale.array;

      let i = 0, j = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          // Wave animation
          const waveY = (Math.sin((ix + count) * 0.15) * 50) + (Math.sin((iy + count) * 0.25) * 50);
          
          // Calculate distance from center for radial scatter
          const centerX = 0;
          const centerZ = 0;
          const distFromCenterX = initialPositions[i] - centerX;
          const distFromCenterZ = initialPositions[i + 2] - centerZ;
          const distanceFromCenter = Math.sqrt(distFromCenterX * distFromCenterX + distFromCenterZ * distFromCenterZ);
          
          // Normalize direction from center
          const normalizedX = distanceFromCenter > 0 ? distFromCenterX / distanceFromCenter : 0;
          const normalizedZ = distanceFromCenter > 0 ? distFromCenterZ / distanceFromCenter : 0;
          
          // Enhanced scatter effect - particles explode outward radially
          const explosionPower = scrollProgress * scrollProgress; // Quadratic for more dramatic effect
          const scatterDistance = distanceFromCenter * explosionPower * 5; // Multiplier for speed
          
          // Radial outward movement
          const scatterX = normalizedX * scatterDistance;
          const scatterZ = normalizedZ * scatterDistance;
          
          // Vertical movement - some go up, some go down based on position
          const verticalVariation = (ix % 2 === 0 ? 1 : -1) * (iy % 2 === 0 ? 1 : -1);
          const scatterY = explosionPower * 1200 * verticalVariation;
          
          // Add rotation effect during scatter
          const rotationAngle = explosionPower * Math.PI * 2;
          const rotatedX = scatterX * Math.cos(rotationAngle) - scatterZ * Math.sin(rotationAngle);
          const rotatedZ = scatterX * Math.sin(rotationAngle) + scatterZ * Math.cos(rotationAngle);
          
          positions[i] = initialPositions[i] + rotatedX;
          positions[i + 1] = waveY + scatterY;
          positions[i + 2] = initialPositions[i + 2] + rotatedZ;
          
          // Scale particles - dramatic shrinking
          const baseScale = (Math.sin((ix + count) * 0.15) + 1) * 6 + (Math.sin((iy + count) * 0.25) + 1) * 6;
          scales[j] = baseScale * (1 - explosionPower * 0.8);
          
          i += 3;
          j++;
        }
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.scale.needsUpdate = true;

      renderer.render(scene, camera);
      count += 0.20;
    }

    init();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', onScroll);
      if (renderer) {
        renderer.dispose();
      }
      if (particles) {
        particles.geometry.dispose();
        particles.material.dispose();
      }
      if (scene) {
        scene.clear();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError('');
    
    // IMPORTANT: Always use the current origin to handle any port changes
    const redirectUrl = `${window.location.origin}/`;
    
    console.log('Current location:', window.location.origin);
    console.log('OAuth redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: "google",
      options: {
        redirectTo: redirectUrl
      }
    });
    
    if (error) {
      console.error('OAuth error:', error);
      setError(error.message);
    }
    setLoading(false);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else if (isSignUp) {
      setError('Check your email for the confirmation link!');
    }
    setLoading(false);
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleActivateAgent = (agent) => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setTimeout(() => setShowLoginModal(true), 1000);
  };

  const handlePlayDemo = (agent) => {
    setSelectedAgent(agent);
  };

  const agents = [
    { name: 'SEOrix', icon: Search, desc: 'AI agent for search engine optimization', videoPlaceholder: 'https://res.cloudinary.com/dry1chfzv/video/upload/v1760383592/_Create_a_cinematic_futuris_mqsfpe.mp4' },
    { name: 'WhatsPulse', icon: MessageCircle, desc: 'Automates WhatsApp marketing campaigns', videoPlaceholder: 'https://res.cloudinary.com/dry1chfzv/video/upload/v1760383595/AI_Marketing_Intro_Video_Generation_rucbpj.mp4' },
    { name: 'GraphiGen', icon: Image, desc: 'Generates stunning graphics for ads & social posts', videoPlaceholder: 'https://res.cloudinary.com/dry1chfzv/video/upload/v1760383593/AI_Design_Agent_Intro_Video_Generation_iguoka.mp4' },
    { name: 'AdVisor', icon: Target, desc: 'Creates optimized ad titles and visuals', videoPlaceholder: 'https://res.cloudinary.com/dry1chfzv/video/upload/v1760383601/AI_Ad_Strategist_Promo_Video_Generated_c1leqv.mp4' },
    { name: 'KeyMuse', icon: Key, desc: 'Generates high-performing marketing keywords', videoPlaceholder: 'KEYMUSE_DEMO_VIDEO' },
    { name: 'SalesCalla', icon: Phone, desc: 'AI-driven sales calling and lead management', videoPlaceholder: 'SALES_DEMO_VIDEO' },
    { name: 'EchoMind', icon: Headphones, desc: 'Analyzes customer recordings for sentiment patterns', videoPlaceholder: 'https://res.cloudinary.com/dry1chfzv/video/upload/v1760383553/AI_Video_Intro_EchoMind_s_Emotional_Insight_xxcqga.mp4' },
    { name: 'TrendIQ', icon: TrendingUp, desc: 'Predicts market trends using data-driven insights', videoPlaceholder: 'TRENDIQ_DEMO_VIDEO' },
    { name: 'Scriptly', icon: FileText, desc: 'Writes compelling video scripts instantly', videoPlaceholder: 'SCRIPTLY_DEMO_VIDEO' },
    { name: 'LostLens', icon: Users, desc: 'Diagnoses customer loss reasons & retention patterns', videoPlaceholder: 'LOSTLENS_DEMO_VIDEO' }
  ];

  const features = [
    { icon: Zap, title: 'Automate Repetitive Tasks', desc: 'Let AI handle routine marketing operations while you focus on strategy' },
    { icon: BarChart3, title: 'Predict Campaign Performance', desc: 'Use data-driven insights to forecast and optimize your campaigns' },
    { icon: Sparkles, title: 'Generate Content Instantly', desc: 'Create compelling marketing content at scale with AI assistance' },
    { icon: Clock, title: 'Analyze Insights in Real-Time', desc: 'Get instant customer insights and actionable recommendations' }
  ];

  const steps = [
    { number: '01', title: 'Pick an AI Agent', desc: 'Choose from 10+ specialized agents for your marketing needs' },
    { number: '02', title: 'Connect Your Tools', desc: 'Seamlessly integrate with your existing CRM and marketing platforms' },
    { number: '03', title: 'Let AI Optimize', desc: 'Watch as AI automates, analyzes, and optimizes your campaigns' }
  ];

  const stats = [
    { value: '10+', label: 'AI Agents Available' },
    { value: '5000+', label: 'Campaigns Automated' },
    { value: '95%', label: 'Predictive Accuracy' },
    { value: '1000+', label: 'Hours Saved' }
  ];

  const testimonials = [
    { name: 'Sarah Johnson', role: 'Marketing Director', company: 'TechFlow Inc.', quote: 'Market Muse AI transformed our workflow. We saw +30% engagement in just 1 week!', avatar: '👩‍💼' },
    { name: 'Michael Chen', role: 'Growth Lead', company: 'StartupX', quote: 'The predictive analytics saved us countless hours and significantly improved our ROI.', avatar: '👨‍💻' },
    { name: 'Emily Rodriguez', role: 'CMO', company: 'BrandCo', quote: 'These AI agents are game-changers. Our content production increased by 3x.', avatar: '👩‍🎨' }
  ];

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #16001e 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      position: 'relative',
      overflow: 'hidden'
    },
    navbar: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 3rem',
      backdropFilter: 'blur(10px)',
      background: scrolled ? 'rgba(10, 10, 15, 0.9)' : 'rgba(255, 255, 255, 0.05)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.3s'
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer'
    },
    logoIcon: {
      width: '40px',
      height: '40px',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '1.25rem',
      boxShadow: '0 0 20px rgba(147,51,234,0.5)'
    },
    logoText: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    navLinks: {
      display: 'flex',
      gap: '2rem',
      alignItems: 'center'
    },
    navLink: {
      color: '#d1d5db',
      textDecoration: 'none',
      transition: 'color 0.3s',
      cursor: 'pointer',
      fontSize: '0.95rem'
    },
    loginButton: {
      padding: '0.5rem 1.5rem',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      border: 'none',
      borderRadius: '8px',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s',
      boxShadow: '0 5px 15px rgba(147,51,234,0.4)',
      fontSize: '0.95rem'
    },
    heroSection: {
      position: 'relative',
      zIndex: 10,
      padding: '8rem 3rem 4rem',
      maxWidth: '1400px',
      margin: '0 auto',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    },
    headline: {
      fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
      fontWeight: 'bold',
      lineHeight: '1.2',
      marginBottom: '1rem',
      animation: 'fadeIn 0.8s ease-out'
    },
    gradientText: {
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 50%, #93c5fd 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    subheading: {
      fontSize: '1.25rem',
      color: '#9ca3af',
      maxWidth: '800px',
      margin: '0 auto 2rem',
      lineHeight: '1.6'
    },
    ctaButtons: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      marginBottom: '4rem',
      flexWrap: 'wrap'
    },
    primaryButton: {
      padding: '0.875rem 2rem',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      border: 'none',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s',
      boxShadow: '0 10px 30px rgba(147,51,234,0.5)'
    },
    secondaryButton: {
      padding: '0.875rem 2rem',
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s'
    },
    section: {
      position: 'relative',
      zIndex: 10,
      padding: '5rem 3rem',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    sectionTitle: {
      fontSize: 'clamp(2rem, 4vw, 3rem)',
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: '1rem'
    },
    sectionSubtitle: {
      fontSize: '1.125rem',
      color: '#9ca3af',
      textAlign: 'center',
      marginBottom: '3rem',
      maxWidth: '700px',
      margin: '0 auto 3rem'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '2rem'
    },
    card: {
      backdropFilter: 'blur(16px)',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      transition: 'all 0.3s',
      cursor: 'pointer'
    },
    agentCard: {
      backdropFilter: 'blur(16px)',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      transition: 'all 0.3s',
      cursor: 'pointer',
      position: 'relative'
    },
    iconWrapper: {
      width: '50px',
      height: '50px',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1rem',
      boxShadow: '0 0 20px rgba(147,51,234,0.5)'
    },
    cardTitle: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      marginBottom: '0.5rem'
    },
    cardDesc: {
      fontSize: '0.875rem',
      color: '#9ca3af',
      marginBottom: '1rem'
    },
    button: {
      width: '100%',
      padding: '0.5rem',
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      color: '#c084fc',
      fontSize: '0.875rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s',
      marginTop: '0.5rem'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '2rem',
      margin: '4rem 0'
    },
    statCard: {
      textAlign: 'center',
      padding: '2rem'
    },
    statValue: {
      fontSize: '3rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #c084fc 0%, #f9a8d4 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      marginBottom: '0.5rem'
    },
    statLabel: {
      fontSize: '1rem',
      color: '#9ca3af'
    },
    stepsContainer: {
      display: 'flex',
      gap: '2rem',
      justifyContent: 'center',
      flexWrap: 'wrap',
      margin: '3rem 0'
    },
    stepCard: {
      flex: '1 1 300px',
      maxWidth: '400px',
      backdropFilter: 'blur(16px)',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      position: 'relative'
    },
    stepNumber: {
      fontSize: '3rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      marginBottom: '1rem'
    },
    testimonialCard: {
      backdropFilter: 'blur(16px)',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      minHeight: '200px'
    },
    avatar: {
      fontSize: '3rem',
      marginBottom: '1rem'
    },
    quote: {
      fontSize: '1rem',
      color: '#d1d5db',
      marginBottom: '1rem',
      fontStyle: 'italic',
      lineHeight: '1.6'
    },
    author: {
      fontSize: '0.95rem',
      fontWeight: '600',
      marginBottom: '0.25rem'
    },
    authorRole: {
      fontSize: '0.875rem',
      color: '#9ca3af'
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
      backdropFilter: 'blur(5px)',
      padding: '1rem'
    },
    modalContent: {
      backdropFilter: 'blur(20px)',
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '20px',
      padding: '2.5rem',
      width: '90%',
      maxWidth: '420px',
      boxShadow: '0 20px 60px rgba(147,51,234,0.3)',
      position: 'relative',
      animation: 'slideUp 0.3s ease-out'
    },
    videoModal: {
      backdropFilter: 'blur(20px)',
      background: 'rgba(10, 10, 15, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '20px',
      padding: '2rem',
      width: '90%',
      maxWidth: '800px',
      boxShadow: '0 20px 60px rgba(147,51,234,0.3)',
      position: 'relative'
    },
    videoPlaceholder: {
      width: '100%',
      aspectRatio: '16/9',
      background: 'linear-gradient(135deg, rgba(147,51,234,0.2) 0%, rgba(236,72,153,0.2) 100%)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem',
      color: '#9ca3af',
      border: '2px dashed rgba(255, 255, 255, 0.2)',
      marginTop: '1rem'
    },
    closeButton: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      color: '#fff',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s'
    },
    toast: {
      position: 'fixed',
      top: '6rem',
      right: '2rem',
      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
      color: '#fff',
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(147,51,234,0.5)',
      zIndex: 1001,
      fontSize: '0.875rem',
      fontWeight: '600',
      transform: showToast ? 'translateX(0)' : 'translateX(400px)',
      transition: 'transform 0.3s ease-in-out',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    ctaSection: {
      textAlign: 'center',
      padding: '5rem 3rem',
      background: 'rgba(147,51,234,0.05)',
      borderRadius: '20px',
      margin: '5rem auto',
      maxWidth: '900px'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .background-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(60px);
          animation: pulse 4s ease-in-out infinite;
          pointer-events: none;
        }
        .blob-1 { top: 80px; left: 80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%); }
        .blob-2 { bottom: 80px; right: 80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%); animation-delay: 1s; }
        .blob-3 { top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; background: radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%); animation-delay: 2s; }
        button:hover:not(:disabled) { transform: translateY(-2px); }
        .login-btn:hover { box-shadow: 0 8px 25px rgba(147,51,234,0.6) !important; }
        .primary-btn:hover { box-shadow: 0 15px 40px rgba(147,51,234,0.7) !important; }
        .secondary-btn:hover { background: rgba(255, 255, 255, 0.15) !important; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .card:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-4px); box-shadow: 0 10px 30px rgba(147,51,234,0.2); }
        .agent-card:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-6px); box-shadow: 0 15px 40px rgba(147,51,234,0.3); }
        .nav-link:hover { color: #fff; }
        input::placeholder { color: #6b7280; }
        input:focus { border-color: #9333ea; box-shadow: 0 0 0 3px rgba(147,51,234,0.1); outline: none; }
        .close-btn:hover { background: rgba(255, 255, 255, 0.2) !important; }
      `}</style>

      {/* WebGL Wave Particle Background */}
      <canvas 
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 0.45
        }}
      />

      <div className="background-blob blob-1"></div>
      <div className="background-blob blob-2"></div>
      <div className="background-blob blob-3"></div>

      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.logo} onClick={() => scrollToSection('hero')}>
          <div style={styles.logoIcon}>M</div>
          <span style={styles.logoText}>Market Muse AI</span>
        </div>
        <div style={styles.navLinks}>
          <a onClick={() => scrollToSection('hero')} style={styles.navLink} className="nav-link">Home</a>
          <a onClick={() => scrollToSection('features')} style={styles.navLink} className="nav-link">Features</a>
          <a onClick={() => scrollToSection('agents')} style={styles.navLink} className="nav-link">Agents</a>
          <a onClick={() => scrollToSection('how-it-works')} style={styles.navLink} className="nav-link">How It Works</a>
          <button 
            onClick={() => setShowLoginModal(true)} 
            style={styles.loginButton}
            className="login-btn"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" style={styles.heroSection}>
        <h1 style={styles.headline}>
          Reimagine Marketing with <br />
          <span style={styles.gradientText}>Autonomous AI Agents</span>
        </h1>
        <p style={styles.subheading}>
          Market Muse AI unites powerful autonomous agents to optimize campaigns, predict trends, analyze performance, and revolutionize marketing workflows — all in one platform.
        </p>
        <div style={styles.ctaButtons}>
          <button onClick={() => scrollToSection('agents')} style={styles.primaryButton} className="primary-btn">
            Explore AI Agents
          </button>
          <button onClick={() => setShowLoginModal(true)} style={styles.secondaryButton} className="secondary-btn">
            Get Started
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <span style={styles.gradientText}>Why Market Muse AI?</span>
        </h2>
        <p style={styles.sectionSubtitle}>
          Powerful AI capabilities designed to transform your marketing operations
        </p>
        <div style={styles.grid}>
          {features.map((feature, idx) => {
            const IconComponent = feature.icon;
            return (
              <div key={idx} style={styles.card} className="card">
                <div style={styles.iconWrapper}>
                  <IconComponent size={28} color="#fff" />
                </div>
                <h3 style={styles.cardTitle}>{feature.title}</h3>
                <p style={styles.cardDesc}>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={styles.section}>
        <h2 style={styles.sectionTitle}>
          How It <span style={styles.gradientText}>Works</span>
        </h2>
        <p style={styles.sectionSubtitle}>
          Get started in three simple steps
        </p>
        <div style={styles.stepsContainer}>
          {steps.map((step, idx) => (
            <div key={idx} style={styles.stepCard}>
              <div style={styles.stepNumber}>{step.number}</div>
              <h3 style={styles.cardTitle}>{step.title}</h3>
              <p style={styles.cardDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Agents Section */}
      <section id="agents" style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <span style={styles.gradientText}>AI Utility Agents</span>
        </h2>
        <p style={styles.sectionSubtitle}>
          Automate. Analyze. Amplify. Your AI marketing copilots await.
        </p>
        <div style={styles.grid}>
          {agents.map((agent, idx) => {
            const IconComponent = agent.icon;
            return (
              <div key={idx} style={styles.agentCard} className="agent-card">
                <div style={styles.iconWrapper}>
                  <IconComponent size={28} color="#fff" />
                </div>
                <h3 style={styles.cardTitle}>{agent.name}</h3>
                <p style={styles.cardDesc}>{agent.desc}</p>
                <button 
                  style={styles.button}
                  onClick={() => handlePlayDemo(agent)}
                >
                  <Play size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Visualize Magic
                </button>
                <button 
                  style={{...styles.button, color: '#fff', background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)'}}
                  onClick={() => handleActivateAgent(agent)}
                  className="primary-btn"
                >
                  Activate Agent
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Trusted by <span style={styles.gradientText}>Thousands</span>
        </h2>
        <div style={styles.statsGrid}>
          {stats.map((stat, idx) => (
            <div key={idx} style={styles.statCard}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          What Our <span style={styles.gradientText}>Users Say</span>
        </h2>
        <p style={styles.sectionSubtitle}>
          See how AI agents transform marketing teams
        </p>
        <div style={styles.grid}>
          {testimonials.map((testimonial, idx) => (
            <div key={idx} style={styles.testimonialCard}>
              <div style={styles.avatar}>{testimonial.avatar}</div>
              <p style={styles.quote}>"{testimonial.quote}"</p>
              <div style={styles.author}>{testimonial.name}</div>
              <div style={styles.authorRole}>{testimonial.role} at {testimonial.company}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA Section */}
      <section style={{...styles.section, ...styles.ctaSection}}>
        <h2 style={{...styles.sectionTitle, marginBottom: '1rem'}}>
          Ready to <span style={styles.gradientText}>Transform</span> Your Marketing?
        </h2>
        <p style={{...styles.sectionSubtitle, marginBottom: '2rem'}}>
          Join thousands of marketers who are already automating their growth with AI
        </p>
        <button onClick={() => setShowLoginModal(true)} style={styles.primaryButton} className="primary-btn">
          Get Started Now
        </button>
      </section>

      {/* Login Modal */}
      {showLoginModal && (
        <div style={styles.modal} onClick={() => setShowLoginModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setShowLoginModal(false)} className="close-btn">
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Welcome Back</h2>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Sign in to access your AI workspace</p>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                background: error.includes('Check your email') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                border: error.includes('Check your email') ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(239,68,68,0.5)',
                color: error.includes('Check your email') ? '#86efac' : '#fca5a5'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#d1d5db' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }}
                  placeholder="you@example.com"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#d1d5db' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }}
                  placeholder="••••••••"
                />
              </div>
              <button
                onClick={handleEmailAuth}
                disabled={loading}
                style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 10px 30px rgba(147,51,234,0.5)' }}
                className="primary-btn"
              >
                {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </div>

            <div style={{ position: 'relative', textAlign: 'center', margin: '1.5rem 0', color: '#9ca3af', fontSize: '0.875rem' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
              <span style={{ position: 'relative', background: 'rgba(255, 255, 255, 0.1)', padding: '0 0.5rem', display: 'inline-block' }}>Or continue with</span>
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#fff', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              className="secondary-btn"
            >
              <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Demo Modal */}
      {selectedAgent && (
        <div style={styles.modal} onClick={() => setSelectedAgent(null)}>
          <div style={styles.videoModal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setSelectedAgent(null)} className="close-btn">
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {selectedAgent.name} Demo
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {selectedAgent.desc}
            </p>
            <div style={styles.videoPlaceholder}>
              {selectedAgent.videoPlaceholder && selectedAgent.videoPlaceholder.startsWith('https://res.cloudinary') ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video 
                    key={selectedAgent.videoPlaceholder}
                    controls 
                    autoPlay
                    playsInline
                    preload="metadata"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: '12px',
                      objectFit: 'contain',
                      backgroundColor: '#1a1a2e'
                    }}
                    onError={(e) => {
                      console.error('Video failed to load:', e.target.error);
                      console.error('Video URL:', selectedAgent.videoPlaceholder);
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                    onLoadStart={() => console.log('Video loading started:', selectedAgent.name)}
                    onCanPlay={(e) => {
                      console.log('Video ready to play:', selectedAgent.name);
                      // Try to play the video with sound
                      e.target.play().catch(() => {
                        // If autoplay fails, try with muted
                        console.log('Autoplay blocked, trying muted autoplay');
                        e.target.muted = true;
                        e.target.play().catch(() => {
                          console.log('Autoplay completely blocked');
                        });
                      });
                    }}
                    onLoadedData={() => console.log('Video data loaded:', selectedAgent.name)}
                  >
                    <source src={selectedAgent.videoPlaceholder} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div style={{ 
                    display: 'none', 
                    textAlign: 'center', 
                    color: '#9ca3af',
                    padding: '2rem' 
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      ⚠️ Video failed to load
                    </div>
                    <a 
                      href={selectedAgent.videoPlaceholder} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        color: '#9333ea', 
                        textDecoration: 'underline' 
                      }}
                    >
                      Open video in new tab
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <Play size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    Video coming soon for {selectedAgent.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    {selectedAgent.videoPlaceholder}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={styles.toast}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={16} />
            <span>Please login first to use the agents!</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;