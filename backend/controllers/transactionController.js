const db = require('../config/db');

exports.createTransaction = (req, res) => {
  const { listing_id, payment_method } = req.body;
  const buyerId = req.user.id;

  if (!listing_id || !payment_method) {
    return res.status(400).json({ error: 'Listing ID and payment method are required.' });
  }

  if (!['cash', 'escrow_payloop'].includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method. Use cash or escrow_payloop.' });
  }

  try {
    // Check if listing exists and is active
    const listingStmt = db.prepare('SELECT user_id, price, status FROM listings WHERE id = ?');
    const listing = listingStmt.get(listing_id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer active.' });
    }

    const sellerId = listing.user_id;

    if (sellerId === buyerId) {
      return res.status(400).json({ error: 'You cannot buy your own listing.' });
    }

    // Check if there is already a pending transaction for this listing-buyer pair
    const checkStmt = db.prepare(`
      SELECT id FROM transactions 
      WHERE listing_id = ? AND buyer_id = ? AND status IN ('pending', 'accepted')
    `);
    const existing = checkStmt.get(listing_id, buyerId);

    if (existing) {
      return res.status(400).json({ error: 'You already have an active purchase order for this item.' });
    }

    // Insert transaction
    const insertStmt = db.prepare(`
      INSERT INTO transactions (listing_id, buyer_id, seller_id, price, payment_method, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    const result = insertStmt.run(listing_id, buyerId, sellerId, listing.price, payment_method);
    const transactionId = result.lastInsertRowid;

    // Get or create chat channel
    const chatStmt = db.prepare('SELECT id FROM chats WHERE listing_id = ? AND buyer_id = ?');
    let chat = chatStmt.get(listing_id, buyerId);

    if (!chat) {
      const insertChatStmt = db.prepare(`
        INSERT INTO chats (listing_id, buyer_id, seller_id)
        VALUES (?, ?, ?)
      `);
      const chatResult = insertChatStmt.run(listing_id, buyerId, sellerId);
      chat = { id: chatResult.lastInsertRowid };
    }

    const savedTransaction = {
      id: transactionId,
      listing_id,
      buyer_id: buyerId,
      seller_id: sellerId,
      price: listing.price,
      payment_method,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Auto-insert a system message into the chat logs
    const paymentLabel = payment_method === 'escrow_payloop' ? 'Escrow Pay-loop (Secure Lock)' : 'Cash / In-Person Pay';
    const systemMessageText = `🛒 [ORDER PLACED] Buyer initiated Buy Now! Method: ${paymentLabel}. Purchase price: $${listing.price}. Order Status: Pending Seller Acceptance.`;
    
    const insertMsgStmt = db.prepare(`
      INSERT INTO messages (chat_id, sender_id, message)
      VALUES (?, ?, ?)
    `);
    const msgResult = insertMsgStmt.run(chat.id, buyerId, systemMessageText);

    // Socket.io notification
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    
    if (io && userSockets) {
      const recipientSocketId = userSockets[sellerId];
      if (recipientSocketId) {
        // Send new transaction event
        io.to(recipientSocketId).emit('receive_transaction', savedTransaction);
        
        // Also send system message through socket
        io.to(recipientSocketId).emit('receive_message', {
          id: msgResult.lastInsertRowid,
          chat_id: chat.id,
          sender_id: buyerId,
          message: systemMessageText,
          created_at: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      message: 'Purchase order placed successfully',
      transaction: savedTransaction,
      chatId: chat.id
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Internal server error processing purchase.' });
  }
};

exports.updateTransactionStatus = (req, res) => {
  const { transactionId } = req.params;
  const { status } = req.body; // 'accepted', 'completed', 'cancelled'
  const userId = req.user.id;

  if (!status || !['accepted', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  try {
    const txStmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const tx = txStmt.get(transactionId);

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (tx.buyer_id !== userId && tx.seller_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to change this transaction.' });
    }

    // Role-specific action checks
    if (status === 'accepted') {
      if (tx.seller_id !== userId) {
        return res.status(403).json({ error: 'Only the seller can accept a purchase proposal.' });
      }
      if (tx.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending transactions can be accepted.' });
      }
    }

    if (status === 'completed') {
      if (tx.status !== 'accepted') {
        return res.status(400).json({ error: 'Only accepted transactions can be completed.' });
      }
      // Escrow requires buyer to release
      if (tx.payment_method === 'escrow_payloop' && tx.buyer_id !== userId) {
        return res.status(403).json({ error: 'Escrow payment release must be confirmed by the buyer.' });
      }
    }

    // Update status
    const updateStmt = db.prepare('UPDATE transactions SET status = ? WHERE id = ?');
    updateStmt.run(status, transactionId);

    // If completed, mark listing as sold
    if (status === 'completed') {
      const updateListingStmt = db.prepare('UPDATE listings SET status = \'sold\' WHERE id = ?');
      updateListingStmt.run(tx.listing_id);
    }

    // Post system message log in chat
    const chatStmt = db.prepare('SELECT id FROM chats WHERE listing_id = ? AND buyer_id = ?');
    const chat = chatStmt.get(tx.listing_id, tx.buyer_id);

    let systemText = '';
    if (status === 'accepted') {
      systemText = `🤝 Seller accepted the purchase order. Transaction is accepted! Schedule a safe meetup point in the planner.`;
    } else if (status === 'completed') {
      const releaseLabel = tx.payment_method === 'escrow_payloop' ? 'Escrow funds released.' : 'In-person payment received.';
      systemText = `🎉 Deal completed successfully! ${releaseLabel} Item marked as SOLD. Please leave a community review for this transaction.`;
    } else if (status === 'cancelled') {
      systemText = `❌ Purchase order cancelled by ${userId === tx.buyer_id ? 'Buyer' : 'Seller'}.`;
    }

    if (chat) {
      const insertMsgStmt = db.prepare(`
        INSERT INTO messages (chat_id, sender_id, message)
        VALUES (?, ?, ?)
      `);
      const msgResult = insertMsgStmt.run(chat.id, userId, systemText);

      // Socket.io notification
      const io = req.app.get('io');
      const userSockets = req.app.get('userSockets');
      const recipientId = tx.buyer_id === userId ? tx.seller_id : tx.buyer_id;

      if (io && userSockets) {
        const recipientSocketId = userSockets[recipientId];
        if (recipientSocketId) {
          // Emit update status event
          io.to(recipientSocketId).emit('transaction_status_updated', {
            transactionId: parseInt(transactionId),
            status,
            listingId: tx.listing_id
          });
          
          // Emit system chat message
          io.to(recipientSocketId).emit('receive_message', {
            id: msgResult.lastInsertRowid,
            chat_id: chat.id,
            sender_id: userId,
            message: systemText,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    res.status(200).json({
      message: `Transaction status updated to ${status}`,
      transactionId,
      status
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Internal server error updating transaction.' });
  }
};

exports.getTransactions = (req, res) => {
  const userId = req.user.id;

  try {
    const listStmt = db.prepare(`
      SELECT t.*, l.title as listing_title, l.image_urls as listing_images,
             u_buyer.username as buyer_name, u_seller.username as seller_name
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN users u_buyer ON t.buyer_id = u_buyer.id
      JOIN users u_seller ON t.seller_id = u_seller.id
      WHERE t.buyer_id = ? OR t.seller_id = ?
      ORDER BY t.created_at DESC
    `);
    const rawTx = listStmt.all(userId, userId);

    const transactions = rawTx.map(tx => {
      let images = [];
      try {
        images = JSON.parse(tx.listing_images || '[]');
      } catch (e) {
        images = [];
      }
      return {
        ...tx,
        listing_images: images
      };
    });

    res.status(200).json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error loading transactions.' });
  }
};

exports.getTransactionByListing = (req, res) => {
  const { listingId } = req.params;
  const userId = req.user.id;

  try {
    const getStmt = db.prepare(`
      SELECT * FROM transactions 
      WHERE listing_id = ? AND (buyer_id = ? OR seller_id = ?) AND status != 'cancelled'
      LIMIT 1
    `);
    const transaction = getStmt.get(listingId, userId, userId);
    
    res.status(200).json({ transaction });
  } catch (error) {
    console.error('Get transaction by listing error:', error);
    res.status(500).json({ error: 'Internal server error fetching transaction details.' });
  }
};
