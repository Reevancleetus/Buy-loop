import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { isMockDatabase } from '../supabaseClient';

const LOCATION_PRESETS = [
  { name: 'NYC City Hall, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Brooklyn Bridge Park, NY', lat: 40.7061, lng: -73.9969 },
  { name: 'Times Square, NY', lat: 40.7580, lng: -73.9855 },
  { name: 'Central Park (Midtown), NY', lat: 40.7829, lng: -73.9654 },
  { name: 'Queensboro Plaza, NY', lat: 40.7489, lng: -73.9402 }
];

const Auth = ({ onAuthSuccess }) => {
  const { login, loginWithGoogle, register } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  
  // Local state for configuration input
  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [dbAnonKey, setDbAnonKey] = useState(localStorage.getItem('supabase_anon_key') || '');
  const [showConfig, setShowConfig] = useState(false);
  
  // Login Form
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState(LOCATION_PRESETS[0].name);
  const [regCoords, setRegCoords] = useState({ lat: LOCATION_PRESETS[0].lat, lng: LOCATION_PRESETS[0].lng });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(loginId, loginPassword);
      setSuccess('Logged in successfully!');
      setTimeout(() => onAuthSuccess(), 1000);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(regUsername, regEmail, regPassword, regCoords.lat, regCoords.lng, regAddress);
      setSuccess('Registered successfully!');
      setTimeout(() => onAuthSuccess(), 1000);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await loginWithGoogle();
      setSuccess('Redirecting to Google Sign-In...');
    } catch (err) {
      setError(err.message || 'Google Sign-In failed');
    }
  };

  const handlePresetSelect = (preset) => {
    setRegAddress(preset.name);
    setRegCoords({ lat: preset.lat, lng: preset.lng });
  };

  const handleLocationMapSelect = (coords) => {
    setRegCoords(coords);
    setRegAddress(`Custom Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
  };

  const handleAddressSearch = async (addressText) => {
    if (!addressText || addressText.length < 3) return;
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=${apiKey}`);
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setRegCoords({ lat: location.lat, lng: location.lng });
      } else {
        alert('Could not find location. Try checking the address spelling or drag the map pin manually.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  return (
    <div style={{
      maxWidth: '850px',
      margin: '40px auto',
      padding: '24px',
      animation: 'fadeIn 0.3s ease-out'
    }} className="glass-panel">
      
      {isMockDatabase && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#d97706',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span>
            💡 <strong>Demo Mode Active:</strong> Using simulated browser storage. Any accounts or items you create are saved locally.
          </span>
          <button 
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: '#d97706',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            {showConfig ? 'Hide Config' : 'Connect Real DB'}
          </button>
        </div>
      )}

      {!isMockDatabase && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: '#059669',
          border: '1px solid #10b981',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span>
            ✅ <strong>Connected:</strong> Using your custom Supabase database coordinates.
          </span>
          <button 
            type="button"
            onClick={() => {
              localStorage.removeItem('supabase_url');
              localStorage.removeItem('supabase_anon_key');
              alert('Credentials cleared! Reverting to Demo Mode. Reloading...');
              window.location.reload();
            }}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Disconnect Real DB
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => { setIsLogin(true); setError(''); }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'none',
            border: 'none',
            color: isLogin ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '18px',
            fontWeight: '700',
            borderBottom: isLogin ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer'
          }}
        >
          Sign In
        </button>
        <button
          onClick={() => { setIsLogin(false); setError(''); }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'none',
            border: 'none',
            color: !isLogin ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '18px',
            fontWeight: '700',
            borderBottom: !isLogin ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer'
          }}
        >
          Create Account
        </button>
      </div>

      {error && (
        <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textTransform: 'none' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textTransform: 'none' }}>
          🎉 {success}
        </div>
      )}

      {isLogin ? (
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Username or Email</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your username or email"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px', marginTop: '12px' }}>
            Sign In
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              fontWeight: '600',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #ddd'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.9c1.69-1.55 2.69-3.85 2.69-6.58z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.25c-.8.54-1.83.87-3.06.87-2.35 0-4.33-1.58-5.04-3.71H.92v2.32A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.6 9c0-.59.1-1.17.28-1.71V4.97H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.03l3.04-2.32z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.3C13.46.87 11.42 0 9 0A9 9 0 0 0 .92 4.97l3.04 2.32C4.67 5.16 6.65 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Username</label>
              <input
                type="text"
                className="input-field"
                placeholder="johndoe"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="john@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Min 6 characters"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Home Location (Hyperlocal center)</label>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Set where you live to prioritize listings in your immediate neighborhood.
            </p>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    backgroundColor: regAddress === preset.name ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                    borderColor: regAddress === preset.name ? 'var(--primary)' : 'var(--border-color)',
                    color: regAddress === preset.name ? 'var(--primary)' : 'var(--text-primary)'
                  }}
                >
                  📍 {preset.name.split(',')[0]}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Address or Location Name"
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAddressSearch(regAddress)}
                  style={{ padding: '0 16px', whiteSpace: 'nowrap' }}
                >
                  🔍 Find on Map
                </button>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '160px' }}>
                Coordinates: <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{regCoords.lat.toFixed(4)}, {regCoords.lng.toFixed(4)}</span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                👉 You can drag the marker or click anywhere on the map to refine your location:
              </p>
              <MapView
                center={[regCoords.lat, regCoords.lng]}
                zoom={12}
                selectionMode={true}
                onLocationSelect={handleLocationMapSelect}
                height="280px"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '14px', marginTop: '12px' }}>
            Create Account & Get Started
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              fontWeight: '600',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #ddd'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.9c1.69-1.55 2.69-3.85 2.69-6.58z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.25c-.8.54-1.83.87-3.06.87-2.35 0-4.33-1.58-5.04-3.71H.92v2.32A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.6 9c0-.59.1-1.17.28-1.71V4.97H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.03l3.04-2.32z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.3C13.46.87 11.42 0 9 0A9 9 0 0 0 .92 4.97l3.04 2.32C4.67 5.16 6.65 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>
        </form>
      )}

      {showConfig && (
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (dbUrl && dbAnonKey) {
              localStorage.setItem('supabase_url', dbUrl.trim());
              localStorage.setItem('supabase_anon_key', dbAnonKey.trim());
              alert('Supabase credentials saved! Reloading application...');
              window.location.reload();
            }
          }} 
          style={{
            marginTop: '24px',
            padding: '20px',
            border: '1px dashed var(--border-color)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700' }}>🔌 Connect to your Supabase Project</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Enter your project keys below. These are stored locally in your browser's memory and won't be saved on any server.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>VITE_SUPABASE_URL</label>
              <input
                type="url"
                className="input-field"
                placeholder="https://your-project-id.supabase.co"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                required
                style={{ fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>VITE_SUPABASE_ANON_KEY</label>
              <input
                type="text"
                className="input-field"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={dbAnonKey}
                onChange={(e) => setDbAnonKey(e.target.value)}
                required
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
            Save & Connect Database
          </button>
        </form>
      )}
    </div>
  );
};

export default Auth;
