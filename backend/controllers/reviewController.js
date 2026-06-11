const db = require('../config/db');

exports.createReview = (req, res) => {
  const { revieweeId, rating, comment, listingId } = req.body;
  const reviewerId = req.user.id;

  if (!revieweeId || !rating || !listingId) {
    return res.status(400).json({ error: 'Reviewee ID, listing ID, and rating (1-5) are required.' });
  }

  const ratingVal = parseInt(rating);
  if (ratingVal < 1 || ratingVal > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  if (parseInt(revieweeId) === reviewerId) {
    return res.status(400).json({ error: 'You cannot review yourself.' });
  }

  try {
    // Verify transaction involves both users and listing is sold/completed
    const chatStmt = db.prepare(`
      SELECT id FROM chats 
      WHERE listing_id = ? AND ((buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?))
    `);
    const chat = chatStmt.get(listingId, reviewerId, revieweeId, revieweeId, reviewerId);

    if (!chat) {
      return res.status(400).json({ error: 'You can only review users you have transacted with for this listing.' });
    }

    // Insert review
    const insertStmt = db.prepare(`
      INSERT INTO reviews (reviewer_id, reviewee_id, rating, comment, listing_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      insertStmt.run(reviewerId, parseInt(revieweeId), ratingVal, comment || '', parseInt(listingId));
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'You have already reviewed this transaction.' });
      }
      throw dbErr;
    }

    // Recalculate average rating for reviewee
    const statsStmt = db.prepare(`
      SELECT AVG(rating) as rating_avg, COUNT(*) as reviews_count 
      FROM reviews WHERE reviewee_id = ?
    `);
    const stats = statsStmt.get(parseInt(revieweeId));

    const newAvg = parseFloat((stats.rating_avg || 0).toFixed(1));
    const newCount = stats.reviews_count || 0;

    // Update user stats
    const updateStmt = db.prepare(`
      UPDATE users SET rating_avg = ?, reviews_count = ? WHERE id = ?
    `);
    updateStmt.run(newAvg, newCount, parseInt(revieweeId));

    res.status(201).json({
      message: 'Review submitted successfully',
      rating_avg: newAvg,
      reviews_count: newCount
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Internal server error submitting review.' });
  }
};

exports.getUserReviews = (req, res) => {
  const { userId } = req.params;

  try {
    const reviewsStmt = db.prepare(`
      SELECT r.*, u.username as reviewer_name, l.title as listing_title
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
    `);
    const reviews = reviewsStmt.all(userId);

    res.status(200).json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error fetching user reviews.' });
  }
};
