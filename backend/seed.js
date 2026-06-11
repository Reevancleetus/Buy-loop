const db = require('./config/db');
const bcrypt = require('bcryptjs');

console.log('Seeding SQLite database with mock hyperlocal data...');

// Clean existing data
db.exec('DELETE FROM reviews');
db.exec('DELETE FROM transactions');
db.exec('DELETE FROM meetups');
db.exec('DELETE FROM messages');
db.exec('DELETE FROM chats');
db.exec('DELETE FROM listings');
db.exec('DELETE FROM users');

// Hash password
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('password123', salt);

// Insert Users
const insertUser = db.prepare(`
  INSERT INTO users (username, email, password_hash, lat, lng, address, rating_avg, reviews_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Locations
const usersData = [
  { name: 'alice', email: 'alice@example.com', lat: 40.7128, lng: -74.0060, addr: 'NYC City Hall, NY', rating: 4.8, count: 5 },
  { name: 'bob', email: 'bob@example.com', lat: 40.7061, lng: -73.9969, addr: 'Brooklyn Bridge Park, NY', rating: 4.5, count: 3 },
  { name: 'charlie', email: 'charlie@example.com', lat: 40.7580, lng: -73.9855, addr: 'Times Square, NY', rating: 4.2, count: 12 },
  { name: 'dave', email: 'dave@example.com', lat: 40.7829, lng: -73.9654, addr: 'Central Park, NY', rating: 5.0, count: 1 },
  { name: 'eve', email: 'eve@example.com', lat: 40.7489, lng: -73.9402, addr: 'Queensboro Plaza, NY', rating: 4.0, count: 2 }
];

const usersMap = {};

usersData.forEach(u => {
  const result = insertUser.run(u.name, u.email, passwordHash, u.lat, u.lng, u.addr, u.rating, u.count);
  usersMap[u.name] = result.lastInsertRowid;
});

console.log('Mock users inserted successfully!');

// Insert Listings
const insertListing = db.prepare(`
  INSERT INTO listings (user_id, title, description, category, price, condition, image_urls, lat, lng, address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const listingsData = [
  {
    seller: 'alice',
    title: 'Comfy Gray Sofa Bed',
    desc: 'Extremely comfortable sofa that folds out into a queen-size bed. Minor tear on the side, but otherwise clean and from a smoke-free home. Perfect for small apartments!',
    cat: 'Furniture',
    price: 150.00,
    cond: 'Good',
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop'],
    lat: 40.7128,
    lng: -74.0060,
    addr: 'Starbucks Lobby, City Hall Park, NY'
  },
  {
    seller: 'bob',
    title: 'iPhone 11 - 128GB Black',
    desc: 'Selling my well-kept iPhone 11. 87% battery health. screen protector applied from day 1, no scratches. Comes with box and charger.',
    cat: 'Electronics',
    price: 220.00,
    cond: 'Like New',
    images: ['https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop'],
    lat: 40.7061,
    lng: -73.9969,
    addr: 'Brooklyn Bridge Park Pier 2, NY'
  },
  {
    seller: 'charlie',
    title: 'Vintage Hybrid Road Bicycle',
    desc: 'Classic hybrid road bike. 18 speeds. Rear rack installed, perfect for commuting or grocery runs. Needs a light tuning but works well.',
    cat: 'Sports',
    price: 120.00,
    cond: 'Fair',
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop'],
    lat: 40.7580,
    lng: -73.9855,
    addr: 'Times Square Starbucks Plaza, NY'
  },
  {
    seller: 'dave',
    title: 'Intro to Algorithms Textbook',
    desc: 'Third Edition of CLRS. Clean copy, no highlighting or writing on pages. Essential reading for computer science students.',
    cat: 'Books',
    price: 35.00,
    cond: 'New',
    images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop'],
    lat: 40.7829,
    lng: -73.9654,
    addr: 'Barnes & Noble Cafe, Midtown NY'
  },
  {
    seller: 'eve',
    title: 'Patagonia Winter Down Jacket',
    desc: 'Super warm down jacket, size Medium. Dark green color. Worn for one season, fully washed and clean. No tears or stains.',
    cat: 'Clothing',
    price: 85.00,
    cond: 'Good',
    images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop'],
    lat: 40.7489,
    lng: -73.9402,
    addr: 'Queensboro Plaza Station Steps, NY'
  },
  {
    seller: 'dave',
    title: 'Dell UltraSharp 27-inch 4K Monitor',
    desc: 'Selling my Dell U2720Q 4K monitor. Excellent color accuracy, ideal for design or programming. Comes with USB-C cable for single cable laptop charging and display.',
    cat: 'Electronics',
    price: 280.00,
    cond: 'Like New',
    images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop'],
    lat: 40.7829,
    lng: -73.9654,
    addr: 'Barnes & Noble Cafe, Midtown NY'
  },
  {
    seller: 'eve',
    title: 'Solid Oak Coffee Table',
    desc: 'Beautiful rustic solid oak coffee table with shelf underneath. Very sturdy, has some light rings from mugs but can be easily sanded and refinished. Solid wood construction.',
    cat: 'Furniture',
    price: 65.00,
    cond: 'Good',
    images: ['https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop'],
    lat: 40.7489,
    lng: -73.9402,
    addr: 'Queensboro Plaza Station Steps, NY'
  },
  {
    seller: 'bob',
    title: 'Coleman 4-Person Camping Tent',
    desc: 'Used only twice. Sets up in under 10 minutes. Fully waterproof rainfly, mesh windows for ventilation. Comes in original carry bag with stakes.',
    cat: 'Other',
    price: 70.00,
    cond: 'Good',
    images: ['https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=500&auto=format&fit=crop'],
    lat: 40.7061,
    lng: -73.9969,
    addr: 'Brooklyn Bridge Park Pier 2, NY'
  },
  {
    seller: 'alice',
    title: 'Leather Travel Backpack',
    desc: 'Premium brown leather backpack, fits a 15-inch laptop. Multiple pockets and organizer compartments. Water-resistant liner. Looks very stylish.',
    cat: 'Clothing',
    price: 40.00,
    cond: 'Like New',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop'],
    lat: 40.7128,
    lng: -74.0060,
    addr: 'Starbucks Lobby, City Hall Park, NY'
  },
  {
    seller: 'charlie',
    title: 'Wilson Clash 100 Tennis Racket',
    desc: 'Grip size 3 (4 3/8). Lightly used with minor scuffs on the bumper guard. Stringing is in decent condition. Great control and comfort.',
    cat: 'Sports',
    price: 30.00,
    cond: 'Good',
    images: ['https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=500&auto=format&fit=crop'],
    lat: 40.7580,
    lng: -73.9855,
    addr: 'Times Square Starbucks Plaza, NY'
  },
  {
    seller: 'dave',
    title: 'Yamaha Pacifica Electric Guitar',
    desc: 'Perfect starter electric guitar. Some scratches on the body, but plays wonderfully and holds tune. Includes gig bag and shoulder strap.',
    cat: 'Other',
    price: 180.00,
    cond: 'Fair',
    images: ['https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=500&auto=format&fit=crop'],
    lat: 40.7829,
    lng: -73.9654,
    addr: 'Barnes & Noble Cafe, Midtown NY'
  }
];

listingsData.forEach(l => {
  // Store full URLs for unsplash images, serialize array
  // If image is an HTTP link, we can store it directly. In ProductCard we handle URL formatting.
  const imageUrlsArray = [l.images[0]];
  
  insertListing.run(
    usersMap[l.seller],
    l.title,
    l.desc,
    l.cat,
    l.price,
    l.cond,
    JSON.stringify(imageUrlsArray),
    l.lat,
    l.lng,
    l.addr
  );
});

console.log('Mock listings inserted successfully!');

// Add a few community reviews
const insertReview = db.prepare(`
  INSERT INTO reviews (reviewer_id, reviewee_id, rating, comment, listing_id)
  VALUES (?, ?, ?, ?, ?)
`);

// Get a listing ID to reference
const listingId = db.prepare('SELECT id FROM listings LIMIT 1').get().id;

insertReview.run(usersMap['bob'], usersMap['alice'], 5, 'Alice was extremely punctual and the couch was exactly as described. Highly recommended seller!', listingId);
insertReview.run(usersMap['charlie'], usersMap['alice'], 4, 'Smooth trade near City Hall. Good communication.', listingId);

// Update Alice's ratings
db.prepare('UPDATE users SET rating_avg = 4.5, reviews_count = 2 WHERE id = ?').run(usersMap['alice']);

console.log('Database seeding complete!');
process.exit(0);
