import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { supabase } from '../supabaseClient';

const SAFE_MEETUP_SPOTS = [
  { name: 'Starbucks Coffee (Public busy place)', latOffset: 0.002, lngOffset: 0.002 },
  { name: 'Police Department Parking Lot (Safe Zone)', latOffset: -0.001, lngOffset: 0.003 },
  { name: 'Local Public Library (Well-lit, public)', latOffset: 0.003, lngOffset: -0.001 },
  { name: 'Busy Transit Station Lobby', latOffset: -0.002, lngOffset: -0.002 }
];

const QUICK_RESPONSES = [
  'Is this item still available?',
  'Where is the best place for you to meet?',
  'Would you be willing to negotiate on the price?',
  'I can meet up today if you are free.'
];

const MOCK_DRIVERS = [
  { id: 1, name: 'Ramesh Kumar', vehicle: 'Tata Ace (Chota Hathi)', phone: '+91 98765 43210', rating: 4.8, ratePerKm: 20, latOffset: 0.008, lngOffset: 0.007 },
  { id: 2, name: 'Suresh Raina', vehicle: 'Mahindra Bolero Pickup', phone: '+91 87654 32109', rating: 4.7, ratePerKm: 25, latOffset: -0.006, lngOffset: 0.012 },
  { id: 3, name: 'Amit Singh', vehicle: 'Auto Rickshaw (Cargo)', phone: '+91 76543 21098', rating: 4.9, ratePerKm: 15, latOffset: 0.004, lngOffset: -0.009 },
  { id: 4, name: 'Vikram Rathore', vehicle: 'E-Rikshaw Loader', phone: '+91 65432 10987', rating: 4.6, ratePerKm: 12, latOffset: -0.011, lngOffset: -0.004 },
  { id: 5, name: 'Pankaj Tripathi', vehicle: 'Maruti Eeco Cargo', phone: '+91 95432 98765', rating: 4.9, ratePerKm: 18, latOffset: 0.014, lngOffset: 0.015 },
  { id: 6, name: 'Manish Pandey', vehicle: 'Motorcycle Delivery', phone: '+91 85432 98764', rating: 4.5, ratePerKm: 8, latOffset: -0.002, lngOffset: -0.002 }
];

// Haversine formula to compute distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
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
  return parseFloat((R * c).toFixed(2));
}

const Chat = ({ initialActiveChatId }) => {
  const { user, simulatedLocation } = useContext(AuthContext);

  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  
  // Meetup Planner State
  const [showMeetupPlanner, setShowMeetupPlanner] = useState(false);
  const [meetupLocation, setMeetupLocation] = useState('');
  const [meetupCoords, setMeetupCoords] = useState(null);
  const [meetupTime, setMeetupTime] = useState('');
  const [meetupsList, setMeetupsList] = useState([]);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const chatEndRef = useRef(null);

  const activeListingLat = activeChat?.listing_lat;
  const activeListingLng = activeChat?.listing_lng;

  const availableDrivers = activeListingLat && activeListingLng
    ? MOCK_DRIVERS.map(d => {
        const driverLat = activeListingLat + d.latOffset;
        const driverLng = activeListingLng + d.lngOffset;
        const dist = calculateDistance(activeListingLat, activeListingLng, driverLat, driverLng);
        return {
          ...d,
          lat: driverLat,
          lng: driverLng,
          distance: dist
        };
      })
      .filter(d => d.distance <= 5.0)
      .sort((a, b) => a.distance - b.distance)
    : [];

  const loadTransaction = useCallback(async () => {
    if (!activeChat) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('listing_id', activeChat.listing_id)
        .maybeSingle();

      if (error) throw error;
      setActiveTransaction(data || null);
    } catch (err) {
      console.error('Error loading transaction details:', err);
    }
  }, [activeChat]);

  const handleUpdateTransaction = async (txId, newStatus) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', txId);

      if (error) throw error;

      setActiveTransaction(prev => prev && prev.id === txId ? { ...prev, status: newStatus } : prev);
      
      if (newStatus === 'completed') {
        setShowReviewModal(true);
      }
      
      loadChats();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to update transaction status');
    }
  };

  // Load chat lists
  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          listings(title, price, image_urls, status, lat, lng, address),
          buyer:users!chats_buyer_id_fkey(username, rating_avg),
          seller:users!chats_seller_id_fkey(username, rating_avg)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (error) throw error;

      const formattedChats = (data || []).map(chat => ({
        ...chat,
        listing_title: chat.listings?.title || 'Unknown Item',
        listing_price: chat.listings?.price || 0,
        listing_images: chat.listings?.image_urls || [],
        listing_status: chat.listings?.status || 'active',
        listing_lat: chat.listings?.lat || null,
        listing_lng: chat.listings?.lng || null,
        listing_address: chat.listings?.address || '',
        buyer_name: chat.buyer?.username || 'Unknown Buyer',
        seller_name: chat.seller?.username || 'Unknown Seller',
        buyer_rating: chat.buyer?.rating_avg || 0.0,
        seller_rating: chat.seller?.rating_avg || 0.0
      }));

      setChats(formattedChats);
      
      // Handle pre-selected chat channel
      if (initialActiveChatId) {
        const selected = formattedChats.find(c => c.id === parseInt(initialActiveChatId));
        if (selected) setActiveChat(selected);
      } else if (formattedChats.length > 0 && !activeChat) {
        setActiveChat(formattedChats[0]);
      }
    } catch (err) {
      console.error('Error loading chats:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initialActiveChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Load messages & meetups when active chat channel changes
  useEffect(() => {
    if (!activeChat) return;

    const loadMessagesAndMeetups = async () => {
      try {
        // Messages
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', activeChat.id)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        setMessages(msgData || []);

        // Meetups
        const { data: meetupData, error: meetupError } = await supabase
          .from('meetups')
          .select('*')
          .eq('chat_id', activeChat.id)
          .order('created_at', { ascending: false });

        if (meetupError) throw meetupError;
        setMeetupsList(meetupData || []);
      } catch (err) {
        console.error(err);
      }
    };

    const checkReviewStatus = async () => {
      if (!user || !activeChat) return;
      try {
        const { data: revData } = await supabase
          .from('reviews')
          .select('id')
          .eq('listing_id', activeChat.listing_id)
          .eq('reviewer_id', user.id)
          .maybeSingle();
        setHasSubmittedReview(!!revData);
      } catch (err) {
        console.error(err);
      }
    };

    loadMessagesAndMeetups();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTransaction();
    checkReviewStatus();
    
    // Default meetup coordinates to center on listing or user
    const baseLat = activeChat.listing_lat || simulatedLocation.lat || 40.7128;
    const baseLng = activeChat.listing_lng || simulatedLocation.lng || -74.0060;
    setMeetupCoords({ lat: baseLat, lng: baseLng });
    setMeetupLocation('');
    setMeetupTime('');
    setShowMeetupPlanner(false);

  }, [activeChat, loadTransaction, user, simulatedLocation]);

  // Bind Supabase Realtime Listeners
  useEffect(() => {
    if (!activeChat) return;

    const sub = supabase
      .channel(`chat-room-${activeChat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMessage = payload.new;
        if (newMessage.chat_id === activeChat.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
        loadChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, payload => {
        const newMeetup = payload.new;
        if (newMeetup.chat_id === activeChat.id) {
          setMeetupsList(prev => {
            const exists = prev.some(m => m.id === newMeetup.id);
            if (exists) {
              return prev.map(m => m.id === newMeetup.id ? newMeetup : m);
            } else {
              return [newMeetup, ...prev];
            }
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
        const newTx = payload.new;
        if (newTx.listing_id === activeChat.listing_id) {
          setActiveTransaction(newTx);
        }
        loadChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [activeChat, loadChats]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message API trigger
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || typedMessage;
    if (!text || !activeChat) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          chat_id: activeChat.id,
          sender_id: user.id,
          message: text
        }])
        .select()
        .single();

      if (error) throw error;
      
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setTypedMessage('');
      loadChats();
    } catch (err) {
      console.error(err);
    }
  };

  // Propose Meetup Spot API
  const handleProposeMeetup = async (e) => {
    e.preventDefault();
    if (!meetupLocation || !meetupCoords || !meetupTime) {
      alert('Please fill in meetup location, pick spots on map, and select a time.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert([{
          chat_id: activeChat.id,
          proposed_by: user.id,
          location_name: meetupLocation,
          lat: parseFloat(meetupCoords.lat),
          lng: parseFloat(meetupCoords.lng),
          meetup_time: meetupTime,
          status: 'proposed'
        }])
        .select()
        .single();

      if (error) throw error;

      setMeetupsList(prev => [data, ...prev]);
      setShowMeetupPlanner(false);
      
      // Send a system message text automatically to chat log to notify other party
      handleSendMessage(`📅 Suggested a safe meetup at: ${meetupLocation} (Time: ${new Date(meetupTime).toLocaleString()}). Please review and accept/decline in the planner.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error proposing meetup');
    }
  };

  // Update Meetup status (Accept/Decline)
  const handleUpdateMeetup = async (meetupId, newStatus) => {
    try {
      const { error } = await supabase
        .from('meetups')
        .update({ status: newStatus })
        .eq('id', meetupId);

      if (error) throw error;

      setMeetupsList(prev => prev.map(m => m.id === meetupId ? { ...m, status: newStatus } : m));
      
      // Auto-send system log text
      const statusText = newStatus === 'accepted' ? 'Accepted ✅' : 'Declined ❌';
      handleSendMessage(`Meetup proposal status update: ${statusText}`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error updating meetup');
    }
  };

  // Mark listing as sold
  const handleMarkAsSold = async () => {
    if (!window.confirm('Mark this listing as SOLD? This action cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', activeChat.listing_id);

      if (error) throw error;

      setActiveChat(prev => ({ ...prev, listing_status: 'sold' }));
      handleSendMessage(`🎉 Marked item as SOLD. The transaction is complete!`);
      setShowReviewModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit User Review rating
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    const otherUserId = user.id === activeChat.buyer_id ? activeChat.seller_id : activeChat.buyer_id;
    try {
      // 1. Submit review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert([{
          reviewer_id: user.id,
          reviewee_id: otherUserId,
          rating: reviewRating,
          comment: reviewComment,
          listing_id: activeChat.listing_id
        }]);

      if (reviewError) throw reviewError;

      // 2. Fetch all reviews for this user to compute average
      const { data: allReviews, error: getReviewsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', otherUserId);

      if (!getReviewsError && allReviews) {
        const count = allReviews.length;
        const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = parseFloat((sum / count).toFixed(2));

        // 3. Update reviewee profile rating_avg and reviews_count
        await supabase
          .from('users')
          .update({
            rating_avg: avg,
            reviews_count: count
          })
          .eq('id', otherUserId);
      }

      alert('Review submitted successfully! Thank you for supporting the community trust system.');
      setShowReviewModal(false);
      setReviewComment('');
      setHasSubmittedReview(true);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to submit review');
    }
  };

  const getOtherPartyName = (chat) => {
    return user.id === chat.buyer_id ? chat.seller_name : chat.buyer_name;
  };

  const getOtherPartyRating = (chat) => {
    return user.id === chat.buyer_id ? chat.seller_rating : chat.buyer_rating;
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '24px',
      height: 'calc(100vh - 140px)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      
      {/* Left Pane: Chats list */}
      <div className="glass-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        height: '100%'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontWeight: '800', margin: 0 }}>Conversations</h3>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {chats.length === 0 ? (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              No active conversations yet. Find an item you like and click "Chat with Seller" to start a conversation.
            </p>
          ) : (
            chats.map(chat => {
              const active = activeChat && activeChat.id === chat.id;
              const isOwner = user.id === chat.seller_id;
              const isSold = chat.listing_status === 'sold';

              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    backgroundColor: active ? 'var(--primary-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)'
                  }}
                >
                  <img
                    src={chat.listing_images.length > 0 ? (chat.listing_images[0].startsWith('http') ? chat.listing_images[0] : `http://localhost:3000${chat.listing_images[0]}`) : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=80&auto=format&fit=crop'}
                    style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    alt=""
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {getOtherPartyName(chat)}
                      </span>
                      {isSold && <span className="badge badge-danger" style={{ fontSize: '9px', padding: '2px 4px' }}>Sold</span>}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {chat.listing_title}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Role: {isOwner ? 'Seller' : 'Buyer'} • ₹{chat.listing_price}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane: Active Chat Room */}
      {activeChat ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', height: '100%' }}>
          
          {/* Main conversation box */}
          <div className="glass-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            height: '100%'
          }}>
            
            {/* Header info */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'between'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Chat with {getOtherPartyName(activeChat)}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  <span>⭐ {getOtherPartyRating(activeChat).toFixed(1)} rating</span>
                  <span>•</span>
                  <span>Listing: <b>{activeChat.listing_title}</b> (₹{activeChat.listing_price})</span>
                </div>
              </div>

              {/* Mark as Sold button (Only for seller of item) */}
              {user.id === activeChat.seller_id && activeChat.listing_status !== 'sold' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleMarkAsSold}
                  style={{ marginLeft: 'auto' }}
                >
                  🤝 Mark as Sold
                </button>
              )}
            </div>

            {/* Message Feed */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', maxWidth: '280px' }}>
                  <span style={{ fontSize: '32px' }}>💬</span>
                  <p style={{ fontSize: '14px', marginTop: '12px' }}>No messages yet. Say hello to start discussing the transaction!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === user.id;
                  const isSystem = msg.message.startsWith('📅') || msg.message.startsWith('🎉') || msg.message.startsWith('Meetup');
                  
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isSystem ? 'center' : (isMine ? 'end' : 'start'),
                        backgroundColor: isSystem ? 'var(--warning-light)' : (isMine ? 'var(--primary)' : 'var(--bg-tertiary)'),
                        color: isSystem ? 'var(--warning)' : (isMine ? 'white' : 'var(--text-primary)'),
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-sm)',
                        maxWidth: '70%',
                        fontSize: '14px',
                        border: isSystem ? '1px solid var(--warning)' : 'none',
                        textAlign: isSystem ? 'center' : 'left'
                      }}
                    >
                      {msg.message}
                      <div style={{
                        fontSize: '9px',
                        textAlign: 'right',
                        marginTop: '4px',
                        color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'
                      }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Responses & Input Form */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Quick response chips */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {QUICK_RESPONSES.map(res => (
                  <button
                    key={res}
                    onClick={() => handleSendMessage(res)}
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap', fontSize: '11px', padding: '6px 12px', borderRadius: '9999px' }}
                  >
                    {res}
                  </button>
                ))}
              </div>

              {/* Message Entry box */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Type a message..."
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  Send
                </button>
              </form>
            </div>

          </div>

          {/* Right Column: Meetup Scheduler & Safety Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
            
            {/* Transaction status Board */}
            {activeTransaction && (
              <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1.5px solid var(--primary)', backgroundColor: 'var(--bg-secondary)' }}>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Order Status
                </h4>
                
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <p>Method: <b>{activeTransaction.payment_method === 'escrow_payloop' ? '🛡️ Escrow Pay-loop' : '💵 Cash Meetup'}</b></p>
                  <p>Amount: <b>₹{activeTransaction.price.toFixed(2)}</b></p>
                  <p style={{ marginTop: '4px' }}>Status: <span className={`badge ${
                    activeTransaction.status === 'completed' ? 'badge-success' : 
                    (activeTransaction.status === 'cancelled' ? 'badge-danger' : 'badge-warning')
                  }`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>{activeTransaction.status}</span></p>
                </div>

                {/* Actions */}
                {activeTransaction.status === 'pending' && user.id === activeTransaction.seller_id && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleUpdateTransaction(activeTransaction.id, 'accepted')}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, backgroundColor: 'var(--success)' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleUpdateTransaction(activeTransaction.id, 'cancelled')}
                      className="btn btn-danger btn-sm"
                      style={{ flex: 1 }}
                    >
                      Decline
                    </button>
                  </div>
                )}

                {activeTransaction.status === 'pending' && user.id === activeTransaction.buyer_id && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '6px', borderRadius: '4px' }}>
                    Waiting for seller to accept...
                  </div>
                )}

                {activeTransaction.status === 'accepted' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activeTransaction.payment_method === 'escrow_payloop' ? (
                      user.id === activeTransaction.buyer_id ? (
                        <button
                          onClick={() => handleUpdateTransaction(activeTransaction.id, 'completed')}
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', backgroundColor: 'var(--success)', fontWeight: '700' }}
                        >
                          Verify Meetup & Release Escrow
                        </button>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic', backgroundColor: 'var(--bg-tertiary)', padding: '6px', borderRadius: '4px' }}>
                          🔒 Funds held in escrow. Awaiting buyer delivery verification.
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handleUpdateTransaction(activeTransaction.id, 'completed')}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', backgroundColor: 'var(--success)', fontWeight: '700' }}
                      >
                        Confirm Transaction Completed
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleUpdateTransaction(activeTransaction.id, 'cancelled')}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                    >
                      Cancel Deal
                    </button>
                  </div>
                )}

                {activeTransaction.status === 'completed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600', textAlign: 'center', backgroundColor: 'var(--success-light)', padding: '6px', borderRadius: '4px' }}>
                      🎉 Completed & Sold!
                    </div>
                    {!hasSubmittedReview && (
                      <button
                        onClick={() => setShowReviewModal(true)}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', fontWeight: '700' }}
                      >
                        ⭐ Review Seller
                      </button>
                    )}
                  </div>
                )}

                {activeTransaction.status === 'cancelled' && (
                  <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600', textAlign: 'center', backgroundColor: 'var(--danger-light)', padding: '6px', borderRadius: '4px' }}>
                    ❌ Order Cancelled
                  </div>
                )}
              </div>
            )}

            {/* Route navigation map */}
            {activeTransaction && (activeTransaction.status === 'pending' || activeTransaction.status === 'accepted' || activeTransaction.status === 'completed') && activeChat && activeChat.listing_lat && activeChat.listing_lng && (
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>📍 Navigation Route</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {(() => {
                    const acceptedMeetup = meetupsList.find(m => m.status === 'accepted');
                    if (acceptedMeetup) {
                      return `Route to meetup spot: ${acceptedMeetup.location_name}`;
                    }
                    return `Route to listing location: ${activeChat.listing_address || 'Seller base'}`;
                  })()}
                </p>
                <div style={{ height: '200px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MapView
                    center={[
                      activeChat.listing_lat,
                      activeChat.listing_lng
                    ]}
                    zoom={12}
                    userLocation={simulatedLocation}
                    route={{
                      start: { lat: simulatedLocation.lat, lng: simulatedLocation.lng },
                      end: (() => {
                        const acceptedMeetup = meetupsList.find(m => m.status === 'accepted');
                        if (acceptedMeetup) {
                          return { lat: acceptedMeetup.lat, lng: acceptedMeetup.lng };
                        }
                        return { lat: activeChat.listing_lat, lng: activeChat.listing_lng };
                      })()
                    }}
                    drivers={availableDrivers}
                    height="100%"
                  />
                </div>
              </div>
            )}

            {/* Local drivers list */}
            {activeTransaction && (activeTransaction.status === 'pending' || activeTransaction.status === 'accepted' || activeTransaction.status === 'completed') && availableDrivers.length > 0 && (
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>🚚 Local Transportation Drivers</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Hyperlocal delivery options within 5 km of the item's listed area.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {availableDrivers.map(driver => (
                    <div
                      key={driver.id}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {driver.name} <span style={{ color: 'var(--warning)', fontWeight: 'normal' }}>★ {driver.rating}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                          {driver.vehicle}
                        </div>
                        <div style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: '600' }}>
                          📍 {driver.distance.toFixed(1)} km away
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--success)' }}>
                          ₹{driver.ratePerKm}/km
                        </div>
                        <button
                          onClick={() => alert(`📞 Call ${driver.name} (${driver.vehicle}) at ${driver.phone} to coordinate pickup/delivery.`)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          Contact
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meetup Proposer drawer */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>📅 Safe Meetup Planner</h4>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMeetupPlanner(!showMeetupPlanner)}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  {showMeetupPlanner ? 'Cancel' : 'Plan +'}
                </button>
              </div>

              {showMeetupPlanner ? (
                <form onSubmit={handleProposeMeetup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>Safe Spot Presets</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {SAFE_MEETUP_SPOTS.map(spot => (
                        <button
                          key={spot.name}
                          type="button"
                          onClick={() => {
                            setMeetupLocation(spot.name);
                            const baseLat = activeChat.listing_lat || simulatedLocation.lat || 40.7128;
                            const baseLng = activeChat.listing_lng || simulatedLocation.lng || -74.0060;
                            setMeetupCoords({ lat: baseLat + spot.latOffset, lng: baseLng + spot.lngOffset });
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '11px',
                            textAlign: 'left',
                            justifyContent: 'start',
                            backgroundColor: meetupLocation === spot.name ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                            borderColor: meetupLocation === spot.name ? 'var(--primary)' : 'var(--border-color)'
                          }}
                        >
                          📍 {spot.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    className="input-field"
                    value={meetupLocation}
                    onChange={(e) => setMeetupLocation(e.target.value)}
                    placeholder="Meetup Place Name"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    required
                  />

                  <input
                    type="datetime-local"
                    className="input-field"
                    value={meetupTime}
                    onChange={(e) => setMeetupTime(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    required
                  />

                  {meetupCoords && (
                    <div style={{ height: '120px', borderRadius: '8px', overflow: 'hidden' }}>
                      <MapView
                        center={[meetupCoords.lat, meetupCoords.lng]}
                        zoom={14}
                        selectionMode={true}
                        onLocationSelect={setMeetupCoords}
                        height="100%"
                      />
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '4px' }}>
                    Propose Meetup
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {meetupsList.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                      No meetups scheduled yet. Suggest a public location to finalize the exchange!
                    </p>
                  ) : (
                    meetupsList.map(meetup => {
                      const isProposedByMe = meetup.proposed_by === user.id;
                      const timeStr = new Date(meetup.meetup_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                      
                      return (
                        <div
                          key={meetup.id}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: meetup.status === 'accepted' ? 'var(--success-light)' : 'var(--bg-tertiary)',
                            border: `1px solid ${meetup.status === 'accepted' ? 'var(--success)' : 'var(--border-color)'}`,
                            fontSize: '12px',
                            boxShadow: meetup.status === 'accepted' ? 'var(--safe-glow)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '4px' }}>
                            <span>📍 {meetup.location_name.split(' (')[0]}</span>
                            <span className={`badge ${meetup.status === 'accepted' ? 'badge-success' : (meetup.status === 'declined' ? 'badge-danger' : 'badge-warning')}`}>
                              {meetup.status}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)' }}>⏰ {timeStr}</p>
                          
                          {meetup.status === 'proposed' && !isProposedByMe && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                              <button
                                onClick={() => handleUpdateMeetup(meetup.id, 'accepted')}
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--success)' }}
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleUpdateMeetup(meetup.id, 'declined')}
                                className="btn btn-danger btn-sm"
                                style={{ flex: 1, padding: '4px', fontSize: '11px' }}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Safety Guidelines checklist */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--success)' }}>🛡️ Community Safety Checklist</h4>
              <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><b>Meet in public:</b> Always choose busy locations during daylight.</li>
                <li><b>No cash carrying:</b> Use digital peer-to-peer apps if possible.</li>
                <li><b>Inspect item:</b> Test operations before transfer of funds.</li>
                <li><b>Bring a friend:</b> Never go to remote coordinates alone.</li>
              </ul>
            </div>

          </div>

        </div>
      ) : (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <p style={{ color: 'var(--text-muted)' }}>Select a conversation from the left sidebar to start chatting!</p>
        </div>
      )}

      {/* Review Modal Form */}
      {showReviewModal && (
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
            maxWidth: '450px',
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontWeight: '700' }}>Submit transaction review</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Rate your experience with <b>{getOtherPartyName(activeChat)}</b> to help keep the community safe.
            </p>

            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Rating Rating *</label>
                <div style={{ display: 'flex', gap: '8px', fontSize: '24px', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      onClick={() => setReviewRating(star)}
                      style={{ color: star <= reviewRating ? 'var(--warning)' : 'var(--text-muted)' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Comments / Feedback</label>
                <textarea
                  className="input-field"
                  rows="3"
                  placeholder="Tell us about the transaction..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReviewModal(false)}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;
