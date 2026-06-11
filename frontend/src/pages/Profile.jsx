import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { supabase } from '../supabaseClient';

const PROFILE_PRESETS = [
  { name: 'NYC City Hall, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Brooklyn Bridge Park, NY', lat: 40.7061, lng: -73.9969 },
  { name: 'Times Square, NY', lat: 40.7580, lng: -73.9855 },
  { name: 'Central Park (Midtown), NY', lat: 40.7829, lng: -73.9654 },
  { name: 'Queensboro Plaza, NY', lat: 40.7489, lng: -73.9402 }
];

const Profile = ({ setCurrentPage }) => {
  const { user, token, simulatedLocation, updateSimulatedLocation } = useContext(AuthContext);

  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Location settings state
  const [editLocation, setEditLocation] = useState(false);
  const [tempCoords, setTempCoords] = useState({ lat: simulatedLocation.lat, lng: simulatedLocation.lng });
  const [tempAddress, setTempAddress] = useState(simulatedLocation.address);

  const loadProfileData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Load user listings directly from Supabase
      const { data: listData, error: listError } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id);

      if (listError) throw listError;
      setListings(listData || []);

      // 2. Load reviews received directly from Supabase (joining users and listings)
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select('*, reviewer:users!reviews_reviewer_id_fkey(username), listings(title)')
        .eq('reviewee_id', user.id);

      if (reviewError) throw reviewError;

      const formattedReviews = (reviewData || []).map(review => ({
        ...review,
        reviewer_name: review.reviewer?.username || 'Anonymous',
        listing_title: review.listings?.title || 'Unknown Product'
      }));

      setReviews(formattedReviews);
    } catch (err) {
      console.error(err);
      setError('Connection error loading profile info.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [user, simulatedLocation]);

  const handleStatusToggle = async (itemId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'sold' : 'active';
    try {
      const { error: toggleError } = await supabase
        .from('listings')
        .update({ status: nextStatus })
        .eq('id', itemId);

      if (toggleError) throw toggleError;
      setListings(prev => prev.map(item => item.id === itemId ? { ...item, status: nextStatus } : item));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteListing = async (itemId) => {
    if (!window.confirm('Are you sure you want to permanently delete this listing?')) return;
    try {
      const { error: deleteError } = await supabase
        .from('listings')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;
      setListings(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLocation = async () => {
    await updateSimulatedLocation(tempCoords.lat, tempCoords.lng, tempAddress);
    setEditLocation(false);
  };

  if (!user) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Please sign in to view your profile.</p>
        <button className="btn btn-primary" onClick={() => setCurrentPage('auth')}>Sign In</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Left Column: User details, rating & mock location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* User Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '48px' }}>👤</span>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>{user.username}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '16px 0' }}>
            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Trust Rating</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ color: 'var(--warning)', fontSize: '18px' }}>★</span>
                <span style={{ fontSize: '18px', fontWeight: '800' }}>{user.rating_avg.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Reviews Recieved</span>
              <span style={{ display: 'block', fontSize: '18px', fontWeight: '800', marginTop: '4px' }}>{user.reviews_count}</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>📍 DEFAULT LOCATION</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditLocation(!editLocation)} style={{ padding: '4px 8px' }}>
                {editLocation ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editLocation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PROFILE_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => { setTempCoords({ lat: preset.lat, lng: preset.lng }); setTempAddress(preset.name); }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '10px', padding: '4px 8px' }}
                    >
                      {preset.name.split(',')[0]}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  className="input-field"
                  value={tempAddress}
                  onChange={(e) => setTempAddress(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                />

                <div style={{ height: '180px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MapView
                    center={[tempCoords.lat, tempCoords.lng]}
                    zoom={12}
                    selectionMode={true}
                    onLocationSelect={setTempCoords}
                    height="100%"
                  />
                </div>

                <button className="btn btn-primary btn-sm" onClick={handleSaveLocation} style={{ width: '100%' }}>
                  Save New Default Location
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '15px', fontWeight: '600' }}>{user.address}</p>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Coordinates: {user.lat.toFixed(4)}, {user.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Community Reviews</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reviews.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No reviews received yet. Completed transactions will enable ratings here.
              </p>
            ) : (
              reviews.map(review => (
                <div key={review.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>👤 {review.reviewer_name}</span>
                    <div style={{ display: 'flex', color: 'var(--warning)', fontSize: '12px' }}>
                      {Array.from({ length: review.rating }).map((_, i) => <span key={i}>★</span>)}
                    </div>
                  </div>
                  {review.listing_title && (
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      For listing: <b>{review.listing_title}</b>
                    </span>
                  )}
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Right Column: Listings inventory manager */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>My Listed Products</h3>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading inventory...</p>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '40px' }}>📦</span>
            <p style={{ fontSize: '14px', marginTop: '12px' }}>You haven't listed any items for sale yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setCurrentPage('create-listing')} style={{ marginTop: '12px' }}>
              Post Item Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {listings.map(item => {
              const images = item.image_urls || [];
              const active = item.status === 'active';

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    alignItems: 'center'
                  }}
                >
                  <img
                    src={images.length > 0 ? (images[0].startsWith('http') ? images[0] : `http://localhost:3000${images[0]}`) : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=80&auto=format&fit=crop'}
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    alt=""
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '15px', fontWeight: '700' }}>
                      {item.title}
                    </h4>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>
                      ${item.price}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Location: {item.address}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '110px' }}>
                    <button
                      onClick={() => handleStatusToggle(item.id, item.status)}
                      className={`btn btn-sm ${active ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '6px', fontSize: '11px', width: '100%' }}
                    >
                      {active ? 'Mark as Sold' : 'Activate Item'}
                    </button>
                    <button
                      onClick={() => handleDeleteListing(item.id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '6px', fontSize: '11px', width: '100%' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default Profile;
