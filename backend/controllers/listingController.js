const db = require('../config/db');
const path = require('path');

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

exports.createListing = (req, res) => {
  const { title, description, category, price, condition, lat, lng, address } = req.body;
  const sellerId = req.user.id;

  if (!title || !description || !category || price === undefined || !condition || lat === undefined || lng === undefined || !address) {
    return res.status(400).json({ error: 'All listing details including location coordinates are required.' });
  }

  try {
    // Process uploaded files
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    }

    const image_urls_str = JSON.stringify(imageUrls);

    const insertStmt = db.prepare(`
      INSERT INTO listings (user_id, title, description, category, price, condition, image_urls, lat, lng, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      sellerId,
      title,
      description,
      category,
      parseFloat(price),
      condition,
      image_urls_str,
      parseFloat(lat),
      parseFloat(lng),
      address
    );

    res.status(201).json({
      message: 'Listing created successfully',
      listingId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Internal server error creating listing.' });
  }
};

exports.getListings = (req, res) => {
  const {
    lat,
    lng,
    radius = 10, // Default 10km
    category,
    search,
    status = 'active',
    sort = 'distance'
  } = req.query;

  try {
    let query = `
      SELECT l.*, u.username, u.rating_avg, u.reviews_count
      FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status
    if (status !== 'all') {
      query += ' AND l.status = ?';
      params.push(status);
    }

    // Filter by category
    if (category && category !== 'All') {
      query += ' AND l.category = ?';
      params.push(category);
    }

    // Filter by search query
    if (search) {
      query += ' AND (l.title LIKE ? OR l.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const listingsStmt = db.prepare(query);
    const rawListings = listingsStmt.all(...params);

    // Calculate distance and filter/sort
    const userLat = lat !== undefined ? parseFloat(lat) : null;
    const userLng = lng !== undefined ? parseFloat(lng) : null;

    let processedListings = rawListings.map(listing => {
      // Parse image URLs
      let image_urls = [];
      try {
        image_urls = JSON.parse(listing.image_urls || '[]');
      } catch (e) {
        image_urls = [];
      }

      const distance = userLat !== null && userLng !== null
        ? calculateDistance(userLat, userLng, listing.lat, listing.lng)
        : null;

      return {
        ...listing,
        image_urls,
        distance
      };
    });

    // Filter by radius if coordinates and radius are provided
    if (userLat !== null && userLng !== null && radius !== 'all') {
      const radiusKm = parseFloat(radius);
      processedListings = processedListings.filter(listing => listing.distance <= radiusKm);
    }

    // Sort listings
    if (sort === 'distance' && userLat !== null && userLng !== null) {
      processedListings.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (sort === 'price_asc') {
      processedListings.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      processedListings.sort((a, b) => b.price - a.price);
    } else {
      // Default: date_desc (newest first)
      processedListings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    res.status(200).json({ listings: processedListings });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Internal server error fetching listings.' });
  }
};

exports.getListingById = (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare(`
      SELECT l.*, u.username, u.rating_avg, u.reviews_count, u.address as seller_address
      FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `);
    const listing = stmt.get(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    // Parse image URLs
    let image_urls = [];
    try {
      image_urls = JSON.parse(listing.image_urls || '[]');
    } catch (e) {
      image_urls = [];
    }

    // If query has user lat/lng, calculate distance
    const userLat = req.query.lat ? parseFloat(req.query.lat) : null;
    const userLng = req.query.lng ? parseFloat(req.query.lng) : null;
    const distance = userLat !== null && userLng !== null
      ? calculateDistance(userLat, userLng, listing.lat, listing.lng)
      : null;

    res.status(200).json({
      listing: {
        ...listing,
        image_urls,
        distance
      }
    });
  } catch (error) {
    console.error('Get listing by ID error:', error);
    res.status(500).json({ error: 'Internal server error fetching listing details.' });
  }
};

exports.updateListingStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' or 'sold'
  const userId = req.user.id;

  if (!status || !['active', 'sold'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required.' });
  }

  try {
    // Check ownership
    const checkStmt = db.prepare('SELECT user_id FROM listings WHERE id = ?');
    const listing = checkStmt.get(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.user_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to modify this listing.' });
    }

    const updateStmt = db.prepare('UPDATE listings SET status = ? WHERE id = ?');
    updateStmt.run(status, id);

    res.status(200).json({ message: 'Listing status updated successfully', status });
  } catch (error) {
    console.error('Update listing status error:', error);
    res.status(500).json({ error: 'Internal server error updating listing status.' });
  }
};

exports.deleteListing = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Check ownership
    const checkStmt = db.prepare('SELECT user_id FROM listings WHERE id = ?');
    const listing = checkStmt.get(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.user_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this listing.' });
    }

    const deleteStmt = db.prepare('DELETE FROM listings WHERE id = ?');
    deleteStmt.run(id);

    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Internal server error deleting listing.' });
  }
};
