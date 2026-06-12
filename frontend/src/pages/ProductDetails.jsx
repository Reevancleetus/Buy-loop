import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { supabase } from '../supabaseClient';

// Haversine formula helper to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return null;
  }
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return parseFloat(distance.toFixed(2)); // round to 2 decimal places
}

const ProductDetails = ({ listingId, onBack, onStartChat, setCurrentPage }) => {
  const { user, token, simulatedLocation } = useContext(AuthContext);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  const handleBuyNow = async () => {
    if (!user) {
      setCurrentPage('auth');
      return;
    }
    setBuying(true);
    setBuyError('');
    try {
      // 1. Check if chat already exists
      let { data: existingChat, error: chatFindError } = await supabase
        .from('chats')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (chatFindError) throw chatFindError;
      let chatId = existingChat?.id;

      // 2. Create chat if it doesn't exist
      if (!chatId) {
        const { data: newChat, error: chatCreateError } = await supabase
          .from('chats')
          .insert([
            {
              listing_id: listingId,
              buyer_id: user.id,
              seller_id: listing.user_id
            }
          ])
          .select()
          .single();

        if (chatCreateError) throw chatCreateError;
        chatId = newChat.id;
      }

      // 3. Create transaction entry
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert([
          {
            listing_id: listingId,
            buyer_id: user.id,
            seller_id: listing.user_id,
            price: listing.price,
            payment_method: paymentMethod,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (txError) throw txError;

      // 4. Send system message in chat
      const systemMsg = `⚡ Transaction initiated using ${paymentMethod === 'escrow_payloop' ? '🛡️ Escrow Pay-loop' : '💵 Cash Meetup'} for ₹${listing.price.toFixed(2)}. Awaiting seller approval.`;
      const { error: msgError } = await supabase
        .from('messages')
        .insert([
          {
            chat_id: chatId,
            sender_id: user.id,
            message: systemMsg
          }
        ]);

      setShowCheckoutModal(false);
      onStartChat(chatId);
    } catch (err) {
      console.error(err);
      setBuyError(err.message || 'Connection error initiating checkout.');
    } finally {
      setBuying(false);
    }
  };

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('listings')
          .select('*, users!inner(username, rating_avg, reviews_count, address)')
          .eq('id', listingId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error('Listing not found');

        const distance = simulatedLocation.lat !== null && simulatedLocation.lng !== null
          ? calculateDistance(simulatedLocation.lat, simulatedLocation.lng, data.lat, data.lng)
          : null;

        const formatted = {
          ...data,
          username: data.users?.username || 'Unknown User',
          rating_avg: data.users?.rating_avg || 0.0,
          reviews_count: data.users?.reviews_count || 0,
          seller_address: data.users?.address || data.address || 'Unknown Address',
          distance
        };

        setListing(formatted);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Connection error loading product details.');
      } finally {
        setLoading(false);
      }
    };

    if (listingId) {
      fetchDetails();
    }
  }, [listingId, simulatedLocation]);

  const handleChatTrigger = async () => {
    if (!user) {
      setCurrentPage('auth');
      return;
    }
    
    try {
      // 1. Check if chat already exists
      let { data: existingChat, error: chatFindError } = await supabase
        .from('chats')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (chatFindError) throw chatFindError;
      let chatId = existingChat?.id;

      // 2. Create chat if it doesn't exist
      if (!chatId) {
        const { data: newChat, error: chatCreateError } = await supabase
          .from('chats')
          .insert([
            {
              listing_id: listingId,
              buyer_id: user.id,
              seller_id: listing.user_id
            }
          ])
          .select()
          .single();

        if (chatCreateError) throw chatCreateError;
        chatId = newChat.id;
      }

      onStartChat(chatId);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error initiating chat channel.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <div style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🔄</div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading listing details...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>⚠️ {error || 'Listing not found'}</p>
        <button className="btn btn-secondary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  const isOwnListing = user && user.id === listing.user_id;
  const isSold = listing.status === 'sold';
  const imageUrls = listing.image_urls || [];
  const activeImage = imageUrls.length > 0
    ? (imageUrls[activeImageIdx].startsWith('http') ? imageUrls[activeImageIdx] : `http://localhost:3000${imageUrls[activeImageIdx]}`)
    : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Back navigation */}
      <div>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to Explore
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '32px'
      }}>
        
        {/* Left Column: Image Gallery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{
            position: 'relative',
            height: '420px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            backgroundColor: 'black'
          }}>
            <img
              src={activeImage}
              alt={listing.title}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            {isSold && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                fontSize: '28px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3
              }}>
                SOLD OUT
              </div>
            )}
            
            <span className="badge badge-distance" style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 2 }}>
              📍 {listing.distance !== null ? `${listing.distance} km away` : 'Calculating...'}
            </span>
          </div>

          {/* Thumbnails */}
          {imageUrls.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {imageUrls.map((url, idx) => (
                <img
                  key={url}
                  src={url.startsWith('http') ? url : `http://localhost:3000${url}`}
                  alt=""
                  onClick={() => setActiveImageIdx(idx)}
                  style={{
                    width: '60px',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    border: activeImageIdx === idx ? '3.5px solid var(--primary)' : '1px solid var(--border-color)',
                    opacity: activeImageIdx === idx ? 1 : 0.7
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Listing Details & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="badge badge-condition" style={{ marginBottom: '8px' }}>
                  Condition: {listing.condition}
                </span>
                <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.2' }}>{listing.title}</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Posted on {new Date(listing.created_at).toLocaleDateString()} in <b>{listing.category}</b>
                </p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--primary)' }}>
                  ₹{listing.price.toFixed(2)}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {listing.description}
            </p>

            {/* Action buttons */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '8px' }}>
              {isOwnListing ? (
                <div style={{ textAlign: 'center' }}>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setCurrentPage('profile')}>
                    Manage Listings in Profile
                  </button>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    This is your listing. You can mark it as sold or delete it from your profile panel.
                  </p>
                </div>
              ) : isSold ? (
                <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                  This Item is Sold
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '14px' }} onClick={handleChatTrigger}>
                    💬 Chat
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '14px' }} onClick={() => setShowCheckoutModal(true)}>
                    ⚡ Buy Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Seller Card */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Seller Profile
            </h4>
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>👤 {listing.username}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  📍 {listing.seller_address}
                </p>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'end' }}>
                  <span style={{ color: 'var(--warning)', fontSize: '18px' }}>★</span>
                  <span style={{ fontWeight: '800', fontSize: '18px' }}>{listing.rating_avg.toFixed(1)}</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ({listing.reviews_count} reviews)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Map location coordinates */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontWeight: '700', marginBottom: '12px' }}>Item Location Map</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Approximated meetup area for this product listing (located at <b>{listing.address}</b>).
        </p>
        <div style={{ height: '300px' }}>
          <MapView
            center={[listing.lat, listing.lng]}
            zoom={14}
            listings={[listing]}
            height="100%"
          />
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
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
            maxWidth: '500px',
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontWeight: '800' }}>⚡ Secure Checkout</h3>
            
            {buyError && (
              <div className="badge badge-danger" style={{ padding: '8px', textTransform: 'none', borderRadius: '4px', width: '100%' }}>
                ⚠️ {buyError}
              </div>
            )}

            <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img
                src={activeImage}
                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                alt=""
              />
              <div>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '15px' }}>{listing.title}</h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Seller: @{listing.username}</p>
                <p style={{ margin: '4px 0 0 0', color: 'var(--primary)', fontWeight: '800' }}>₹{listing.price.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '14px' }}>Choose Secure Transaction Method</label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '12px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: paymentMethod === 'cash' ? 'var(--primary-light)' : 'transparent',
                  borderColor: paymentMethod === 'cash' ? 'var(--primary)' : 'var(--border-color)'
                }}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    style={{ marginTop: '4px', accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '14px', display: 'block' }}>💵 Cash on Delivery (Meetup Exchange)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Finalize payment in-person via cash or direct mobile app when you meet the seller.
                    </span>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '12px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: paymentMethod === 'escrow_payloop' ? 'var(--primary-light)' : 'transparent',
                  borderColor: paymentMethod === 'escrow_payloop' ? 'var(--primary)' : 'var(--border-color)'
                }}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="escrow_payloop"
                    checked={paymentMethod === 'escrow_payloop'}
                    onChange={() => setPaymentMethod('escrow_payloop')}
                    style={{ marginTop: '4px', accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '14px', display: 'block' }}>🛡️ Secure Escrow Pay-loop</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Funds are held securely by Buy-loop. We release them to the seller only after you meet up and verify the item!
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Safety block */}
            <div style={{ backgroundColor: 'var(--success-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--success)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              🛡️ <b>Secure Transactions Policy</b>: Hyperlocal exchanges should happen in public, well-lit spaces. Agree on a meetup location using the chat planner next.
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'end', marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCheckoutModal(false)}
                disabled={buying}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBuyNow}
                disabled={buying}
              >
                {buying ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetails;
