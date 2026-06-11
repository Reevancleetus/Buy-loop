const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'buy_loop_super_secret_key';

exports.register = (req, res) => {
  const { username, email, password, lat, lng, address } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  try {
    // Check if user already exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    const existing = checkStmt.get(username, email);

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Default coordinates (NYC City Hall) if not provided
    const userLat = lat !== undefined ? parseFloat(lat) : 40.7128;
    const userLng = lng !== undefined ? parseFloat(lng) : -74.0060;
    const userAddress = address || 'NYC City Hall, NY';

    // Insert user
    const insertStmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, lat, lng, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insertStmt.run(username, email, passwordHash, userLat, userLng, userAddress);
    const userId = result.lastInsertRowid;

    // Generate JWT
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username,
        email,
        lat: userLat,
        lng: userLng,
        address: userAddress,
        rating_avg: 0.0,
        reviews_count: 0
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

exports.login = (req, res) => {
  const { loginIdentifier, password } = req.body; // username or email

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    const userStmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    const user = userStmt.get(loginIdentifier, loginIdentifier);

    if (!user) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        lat: user.lat,
        lng: user.lng,
        address: user.address,
        rating_avg: user.rating_avg,
        reviews_count: user.reviews_count
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
};

exports.getMe = (req, res) => {
  try {
    const userStmt = db.prepare(`
      SELECT id, username, email, lat, lng, address, rating_avg, reviews_count
      FROM users WHERE id = ?
    `);
    const user = userStmt.get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

exports.updateLocation = (req, res) => {
  const { lat, lng, address } = req.body;

  if (lat === undefined || lng === undefined || !address) {
    return res.status(400).json({ error: 'Latitude, longitude, and address are required.' });
  }

  try {
    const updateStmt = db.prepare(`
      UPDATE users SET lat = ?, lng = ?, address = ? WHERE id = ?
    `);
    updateStmt.run(parseFloat(lat), parseFloat(lng), address, req.user.id);

    res.status(200).json({
      message: 'Location updated successfully',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error updating location.' });
  }
};
