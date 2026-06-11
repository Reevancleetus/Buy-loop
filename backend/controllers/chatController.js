const db = require('../config/db');

// Get all active chats for a user (either as buyer or seller)
exports.getChats = (req, res) => {
  const userId = req.user.id;

  try {
    const chatsStmt = db.prepare(`
      SELECT 
        c.id, c.listing_id, c.buyer_id, c.seller_id, c.created_at,
        l.title as listing_title, 
        l.price as listing_price, 
        l.image_urls as listing_images, 
        l.status as listing_status,
        u_buyer.username as buyer_name, 
        u_buyer.rating_avg as buyer_rating,
        u_seller.username as seller_name,
        u_seller.rating_avg as seller_rating
      FROM chats c
      JOIN listings l ON c.listing_id = l.id
      JOIN users u_buyer ON c.buyer_id = u_buyer.id
      JOIN users u_seller ON c.seller_id = u_seller.id
      WHERE c.buyer_id = ? OR c.seller_id = ?
      ORDER BY c.created_at DESC
    `);
    
    const chats = chatsStmt.all(userId, userId).map(chat => {
      let images = [];
      try {
        images = JSON.parse(chat.listing_images || '[]');
      } catch (e) {
        images = [];
      }
      return {
        ...chat,
        listing_images: images
      };
    });

    res.status(200).json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Internal server error fetching chats.' });
  }
};

// Create or get chat channel between buyer and seller for a listing
exports.getOrCreateChat = (req, res) => {
  const { listing_id } = req.body;
  const buyerId = req.user.id;

  if (!listing_id) {
    return res.status(400).json({ error: 'Listing ID is required.' });
  }

  try {
    // Get listing to find seller
    const listingStmt = db.prepare('SELECT user_id, status FROM listings WHERE id = ?');
    const listing = listingStmt.get(listing_id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const sellerId = listing.user_id;

    if (sellerId === buyerId) {
      return res.status(400).json({ error: 'You cannot start a chat with yourself.' });
    }

    // Check if chat already exists
    const chatStmt = db.prepare('SELECT id FROM chats WHERE listing_id = ? AND buyer_id = ?');
    let chat = chatStmt.get(listing_id, buyerId);

    if (!chat) {
      // Create new chat
      const insertStmt = db.prepare(`
        INSERT INTO chats (listing_id, buyer_id, seller_id)
        VALUES (?, ?, ?)
      `);
      const result = insertStmt.run(listing_id, buyerId, sellerId);
      chat = { id: result.lastInsertRowid };
    }

    res.status(200).json({ chatId: chat.id });
  } catch (error) {
    console.error('Get or create chat error:', error);
    res.status(500).json({ error: 'Internal server error creating chat.' });
  }
};

// Get messages for a specific chat
exports.getMessages = (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user belongs to this chat
    const checkStmt = db.prepare('SELECT buyer_id, seller_id FROM chats WHERE id = ?');
    const chat = checkStmt.get(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to access this conversation.' });
    }

    const messagesStmt = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC');
    const messages = messagesStmt.all(chatId);

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error loading messages.' });
  }
};

// Send a message in a chat
exports.sendMessage = (req, res) => {
  const { chatId } = req.params;
  const { message } = req.body;
  const senderId = req.user.id;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  try {
    // Verify user belongs to this chat
    const checkStmt = db.prepare('SELECT buyer_id, seller_id FROM chats WHERE id = ?');
    const chat = checkStmt.get(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (chat.buyer_id !== senderId && chat.seller_id !== senderId) {
      return res.status(403).json({ error: 'You are not authorized to send messages to this conversation.' });
    }

    // Insert message
    const insertStmt = db.prepare(`
      INSERT INTO messages (chat_id, sender_id, message)
      VALUES (?, ?, ?)
    `);
    const result = insertStmt.run(chatId, senderId, message);
    const newMessageId = result.lastInsertRowid;

    const savedMessage = {
      id: newMessageId,
      chat_id: parseInt(chatId),
      sender_id: senderId,
      message,
      created_at: new Date().toISOString()
    };

    // Socket.io notification
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const recipientId = chat.buyer_id === senderId ? chat.seller_id : chat.buyer_id;

    if (io && userSockets) {
      const recipientSocketId = userSockets[recipientId];
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_message', savedMessage);
      }
    }

    res.status(201).json({ message: savedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error sending message.' });
  }
};

// Propose a meetup spot
exports.proposeMeetup = (req, res) => {
  const { chatId, location_name, lat, lng, meetup_time } = req.body;
  const userId = req.user.id;

  if (!chatId || !location_name || lat === undefined || lng === undefined || !meetup_time) {
    return res.status(400).json({ error: 'Meetup spot location name, coordinates, and time are required.' });
  }

  try {
    // Verify user belongs to this chat
    const checkStmt = db.prepare('SELECT buyer_id, seller_id FROM chats WHERE id = ?');
    const chat = checkStmt.get(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to suggest meetups for this chat.' });
    }

    // Insert meetup proposal
    const insertStmt = db.prepare(`
      INSERT INTO meetups (chat_id, proposed_by, location_name, lat, lng, meetup_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insertStmt.run(chatId, userId, location_name, parseFloat(lat), parseFloat(lng), meetup_time);

    const newMeetup = {
      id: result.lastInsertRowid,
      chat_id: parseInt(chatId),
      proposed_by: userId,
      location_name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      meetup_time,
      status: 'proposed',
      created_at: new Date().toISOString()
    };

    // Socket.io notification
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const recipientId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;

    if (io && userSockets) {
      const recipientSocketId = userSockets[recipientId];
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_meetup', newMeetup);
      }
    }

    res.status(201).json({
      message: 'Meetup proposed successfully',
      meetup: newMeetup
    });
  } catch (error) {
    console.error('Propose meetup error:', error);
    res.status(500).json({ error: 'Internal server error proposing meetup.' });
  }
};

// Update meetup status (accept, decline, complete)
exports.updateMeetupStatus = (req, res) => {
  const { meetupId } = req.params;
  const { status } = req.body; // 'accepted', 'declined', 'completed'
  const userId = req.user.id;

  if (!status || !['accepted', 'declined', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  try {
    const meetupStmt = db.prepare(`
      SELECT m.*, c.buyer_id, c.seller_id 
      FROM meetups m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.id = ?
    `);
    const meetup = meetupStmt.get(meetupId);

    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found.' });
    }

    if (meetup.buyer_id !== userId && meetup.seller_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to change this meetup status.' });
    }

    // For acceptance/decline, verify the other party is doing it
    if (status === 'accepted' || status === 'declined') {
      if (meetup.proposed_by === userId) {
        return res.status(400).json({ error: 'You cannot respond to your own proposal.' });
      }
    }

    const updateStmt = db.prepare('UPDATE meetups SET status = ? WHERE id = ?');
    updateStmt.run(status, meetupId);

    // Socket.io notification
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const recipientId = meetup.buyer_id === userId ? meetup.seller_id : meetup.buyer_id;

    if (io && userSockets) {
      const recipientSocketId = userSockets[recipientId];
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('meetup_status_updated', {
          meetupId: parseInt(meetupId),
          status,
          chatId: meetup.chat_id
        });
      }
    }

    res.status(200).json({
      message: `Meetup status updated to ${status}`,
      meetupId,
      status
    });
  } catch (error) {
    console.error('Update meetup status error:', error);
    res.status(500).json({ error: 'Internal server error updating meetup.' });
  }
};

// Get meetups for a chat
exports.getMeetups = (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    const checkStmt = db.prepare('SELECT buyer_id, seller_id FROM chats WHERE id = ?');
    const chat = checkStmt.get(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const meetupsStmt = db.prepare('SELECT * FROM meetups WHERE chat_id = ? ORDER BY created_at DESC');
    const meetups = meetupsStmt.all(chatId);

    res.status(200).json({ meetups });
  } catch (error) {
    console.error('Get meetups error:', error);
    res.status(500).json({ error: 'Internal server error fetching meetups.' });
  }
};

