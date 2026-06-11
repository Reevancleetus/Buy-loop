import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import MapView from '../common/MapView';

const LOCATION_PRESETS = [
  { name: 'NYC City Hall, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Brooklyn Bridge Park, NY', lat: 40.7061, lng: -73.9969 },
  { name: 'Times Square, NY', lat: 40.7580, lng: -73.9855 },
  { name: 'Central Park (Midtown), NY', lat: 40.7829, lng: -73.9654 },
  { name: 'Queensboro Plaza, NY', lat: 40.7489, lng: -73.9402 }
];

const Navbar = ({ currentPage, setCurrentPage }) => {
  const { user, logout, simulatedLocation, updateSimulatedLocation } = useContext(AuthContext);
  const [theme, setTheme] = useState('light');
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Temporary coordinates for mapping
  const [tempCoords, setTempCoords] = useState({ lat: simulatedLocation.lat, lng: simulatedLocation.lng });
  const [tempAddress, setTempAddress] = useState(simulatedLocation.address);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleOpenLocationModal = () => {
    setTempCoords({ lat: simulatedLocation.lat, lng: simulatedLocation.lng });
    setTempAddress(simulatedLocation.address);
    setShowLocationModal(true);
  };

  const handleSaveLocation = () => {
    updateSimulatedLocation(tempCoords.lat, tempCoords.lng, tempAddress);
    setShowLocationModal(false);
  };

  const selectPreset = (preset) => {
    setTempCoords({ lat: preset.lat, lng: preset.lng });
    setTempAddress(preset.name);
  };

  return (
    <>
      <nav className="glass-panel" style={{
        margin: '16px 16px 0 16px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'between',
        flexWrap: 'wrap',
        gap: '16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--glass-border)',
        zIndex: 100
      }}>
        {/* Brand */}
        <div 
          onClick={() => setCurrentPage('home')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800',
            fontSize: '24px'
          }}
        >
          <span>Buy-loop</span>
          <span style={{ fontSize: '20px', WebkitTextFillColor: 'initial' }}>🔄</span>
        </div>

        {/* Hyperlocal Simulation Center */}
        <div 
          onClick={handleOpenLocationModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent)',
            padding: '8px 12px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: '1px dashed var(--accent)',
            maxWidth: '320px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title="Click to simulate moving to a different location"
        >
          📍 <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>Search Center: {simulatedLocation.address}</span>
        </div>

        {/* Main Nav Items */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
          <button 
            className={`btn btn-sm ${currentPage === 'home' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentPage('home')}
          >
            Explore
          </button>
          
          {user ? (
            <>
              <button 
                className={`btn btn-sm ${currentPage === 'create-listing' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentPage('create-listing')}
              >
                + Sell Item
              </button>
              <button 
                className={`btn btn-sm ${currentPage === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentPage('chat')}
              >
                Chats
              </button>
              <button 
                className={`btn btn-sm ${currentPage === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentPage('profile')}
              >
                Profile
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => { logout(); setCurrentPage('auth'); }}
                style={{ color: 'var(--danger)' }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentPage('auth')}
            >
              Sign In
            </button>
          )}

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-tertiary)',
              border: `1px solid var(--border-color)`,
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
            title="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      {/* Location Simulation Modal */}
      {showLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '550px',
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontWeight: '700' }}>Simulate Search Location</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Change your simulated browser geolocation coordinates to test nearby listing radius calculations.
            </p>

            {/* Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    backgroundColor: tempAddress === preset.name ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                    borderColor: tempAddress === preset.name ? 'var(--primary)' : 'var(--border-color)',
                    color: tempAddress === preset.name ? 'var(--primary)' : 'var(--text-primary)'
                  }}
                >
                  {preset.name.split(',')[0]}
                </button>
              ))}
            </div>

            {/* Manual input */}
            <input 
              type="text" 
              className="input-field" 
              value={tempAddress} 
              onChange={(e) => setTempAddress(e.target.value)} 
              placeholder="Address / Location Name"
            />

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Coordinates: <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{tempCoords.lat.toFixed(4)}, {tempCoords.lng.toFixed(4)}</span>
            </div>

            {/* Interactive Picker */}
            <MapView 
              center={[tempCoords.lat, tempCoords.lng]} 
              zoom={12} 
              selectionMode={true} 
              onLocationSelect={(coords) => {
                setTempCoords(coords);
                setTempAddress(`Custom Point (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
              }}
              height="200px"
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'end', marginTop: '8px' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowLocationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSaveLocation}
              >
                Apply simulated location
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
