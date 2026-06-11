/**
 * Supabase Seed Script for Buy-loop Hyperlocal Marketplace
 * 
 * This script seeds your Supabase database with mock data.
 * It uses the Supabase Admin API (service_role key) to bypass RLS.
 * 
 * Prerequisites:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
 *   2. Run: npm run seed
 * 
 * Note: The service_role key can be found in your Supabase Dashboard -> Settings -> API -> service_role key.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'your-service-role-key-here') {
  console.error('❌ Missing Supabase credentials!');
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  console.error('   Find your service_role key in: Supabase Dashboard → Settings → API');
  process.exit(1);
}

// Use service_role key to bypass RLS for seeding
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log('🌱 Seeding Supabase database with mock hyperlocal data...\n');

  // Step 1: Clean existing data (order matters due to foreign keys)
  console.log('🧹 Cleaning existing data...');
  await supabase.from('reviews').delete().neq('id', 0);
  await supabase.from('transactions').delete().neq('id', 0);
  await supabase.from('meetups').delete().neq('id', 0);
  await supabase.from('messages').delete().neq('id', 0);
  await supabase.from('chats').delete().neq('id', 0);
  await supabase.from('listings').delete().neq('id', 0);
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   ✅ Existing data cleared.\n');

  // Step 2: Create users via Supabase Auth + public.users profile
  console.log('👤 Creating mock users...');
  const usersData = [
    { username: 'alice', email: 'alice@example.com', password: 'password123', lat: 40.7128, lng: -74.0060, address: 'NYC City Hall, NY', rating_avg: 4.8, reviews_count: 5 },
    { username: 'bob', email: 'bob@example.com', password: 'password123', lat: 40.7061, lng: -73.9969, address: 'Brooklyn Bridge Park, NY', rating_avg: 4.5, reviews_count: 3 },
    { username: 'charlie', email: 'charlie@example.com', password: 'password123', lat: 40.7580, lng: -73.9855, address: 'Times Square, NY', rating_avg: 4.2, reviews_count: 12 },
    { username: 'dave', email: 'dave@example.com', password: 'password123', lat: 40.7829, lng: -73.9654, address: 'Central Park, NY', rating_avg: 5.0, reviews_count: 1 },
    { username: 'eve', email: 'eve@example.com', password: 'password123', lat: 40.7489, lng: -73.9402, address: 'Queensboro Plaza, NY', rating_avg: 4.0, reviews_count: 2 }
  ];

  const usersMap = {};

  for (const u of usersData) {
    // Create auth user (using admin API to skip email confirmation)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true // Auto-confirm email
    });

    if (authError) {
      // User might already exist, try to find them
      if (authError.message.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(eu => eu.email === u.email);
        if (existing) {
          usersMap[u.username] = existing.id;
          // Update profile
          await supabase.from('users').upsert({
            id: existing.id,
            username: u.username,
            email: u.email,
            lat: u.lat,
            lng: u.lng,
            address: u.address,
            rating_avg: u.rating_avg,
            reviews_count: u.reviews_count
          });
          console.log(`   ⚠️  User ${u.username} already exists, updated profile.`);
          continue;
        }
      }
      console.error(`   ❌ Failed to create user ${u.username}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    usersMap[u.username] = userId;

    // Insert public profile
    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      username: u.username,
      email: u.email,
      lat: u.lat,
      lng: u.lng,
      address: u.address,
      rating_avg: u.rating_avg,
      reviews_count: u.reviews_count
    });

    if (profileError) {
      console.error(`   ❌ Failed to create profile for ${u.username}:`, profileError.message);
    } else {
      console.log(`   ✅ User ${u.username} created (${userId})`);
    }
  }

  console.log(`\n   ${Object.keys(usersMap).length} users ready.\n`);

  // Step 3: Insert listings
  console.log('📦 Creating mock listings...');
  const listingsData = [
    {
      seller: 'alice',
      title: 'Comfy Gray Sofa Bed',
      description: 'Extremely comfortable sofa that folds out into a queen-size bed. Minor tear on the side, but otherwise clean and from a smoke-free home. Perfect for small apartments!',
      category: 'Furniture',
      price: 150.00,
      condition: 'Good',
      image_urls: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop'],
      lat: 40.7128, lng: -74.0060,
      address: 'Starbucks Lobby, City Hall Park, NY'
    },
    {
      seller: 'bob',
      title: 'iPhone 11 - 128GB Black',
      description: 'Selling my well-kept iPhone 11. 87% battery health. Screen protector applied from day 1, no scratches. Comes with box and charger.',
      category: 'Electronics',
      price: 220.00,
      condition: 'Like New',
      image_urls: ['https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop'],
      lat: 40.7061, lng: -73.9969,
      address: 'Brooklyn Bridge Park Pier 2, NY'
    },
    {
      seller: 'charlie',
      title: 'Vintage Hybrid Road Bicycle',
      description: 'Classic hybrid road bike. 18 speeds. Rear rack installed, perfect for commuting or grocery runs. Needs a light tuning but works well.',
      category: 'Sports',
      price: 120.00,
      condition: 'Fair',
      image_urls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop'],
      lat: 40.7580, lng: -73.9855,
      address: 'Times Square Starbucks Plaza, NY'
    },
    {
      seller: 'dave',
      title: 'Intro to Algorithms Textbook',
      description: 'Third Edition of CLRS. Clean copy, no highlighting or writing on pages. Essential reading for computer science students.',
      category: 'Books',
      price: 35.00,
      condition: 'New',
      image_urls: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop'],
      lat: 40.7829, lng: -73.9654,
      address: 'Barnes & Noble Cafe, Midtown NY'
    },
    {
      seller: 'eve',
      title: 'Patagonia Winter Down Jacket',
      description: 'Super warm down jacket, size Medium. Dark green color. Worn for one season, fully washed and clean. No tears or stains.',
      category: 'Clothing',
      price: 85.00,
      condition: 'Good',
      image_urls: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop'],
      lat: 40.7489, lng: -73.9402,
      address: 'Queensboro Plaza Station Steps, NY'
    },
    {
      seller: 'dave',
      title: 'Dell UltraSharp 27-inch 4K Monitor',
      description: 'Selling my Dell U2720Q 4K monitor. Excellent color accuracy, ideal for design or programming. Comes with USB-C cable.',
      category: 'Electronics',
      price: 280.00,
      condition: 'Like New',
      image_urls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop'],
      lat: 40.7829, lng: -73.9654,
      address: 'Barnes & Noble Cafe, Midtown NY'
    },
    {
      seller: 'eve',
      title: 'Solid Oak Coffee Table',
      description: 'Beautiful rustic solid oak coffee table with shelf underneath. Very sturdy. Solid wood construction.',
      category: 'Furniture',
      price: 65.00,
      condition: 'Good',
      image_urls: ['https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop'],
      lat: 40.7489, lng: -73.9402,
      address: 'Queensboro Plaza Station Steps, NY'
    },
    {
      seller: 'bob',
      title: 'Coleman 4-Person Camping Tent',
      description: 'Used only twice. Sets up in under 10 minutes. Fully waterproof rainfly, mesh windows for ventilation.',
      category: 'Other',
      price: 70.00,
      condition: 'Good',
      image_urls: ['https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=500&auto=format&fit=crop'],
      lat: 40.7061, lng: -73.9969,
      address: 'Brooklyn Bridge Park Pier 2, NY'
    },
    {
      seller: 'alice',
      title: 'Leather Travel Backpack',
      description: 'Premium brown leather backpack, fits a 15-inch laptop. Multiple pockets and organizer compartments.',
      category: 'Clothing',
      price: 40.00,
      condition: 'Like New',
      image_urls: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop'],
      lat: 40.7128, lng: -74.0060,
      address: 'Starbucks Lobby, City Hall Park, NY'
    },
    {
      seller: 'charlie',
      title: 'Wilson Clash 100 Tennis Racket',
      description: 'Grip size 3 (4 3/8). Lightly used with minor scuffs on the bumper guard. Great control and comfort.',
      category: 'Sports',
      price: 30.00,
      condition: 'Good',
      image_urls: ['https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=500&auto=format&fit=crop'],
      lat: 40.7580, lng: -73.9855,
      address: 'Times Square Starbucks Plaza, NY'
    },
    {
      seller: 'dave',
      title: 'Yamaha Pacifica Electric Guitar',
      description: 'Perfect starter electric guitar. Some scratches on the body, but plays wonderfully. Includes gig bag.',
      category: 'Other',
      price: 180.00,
      condition: 'Fair',
      image_urls: ['https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=500&auto=format&fit=crop'],
      lat: 40.7829, lng: -73.9654,
      address: 'Barnes & Noble Cafe, Midtown NY'
    }
  ];

  const insertedListings = [];
  for (const l of listingsData) {
    const sellerId = usersMap[l.seller];
    if (!sellerId) {
      console.error(`   ❌ Skipping listing "${l.title}" — seller ${l.seller} not found.`);
      continue;
    }

    const { data, error } = await supabase.from('listings').insert({
      user_id: sellerId,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      condition: l.condition,
      image_urls: l.image_urls,
      lat: l.lat,
      lng: l.lng,
      address: l.address,
      status: 'active'
    }).select();

    if (error) {
      console.error(`   ❌ Failed to insert listing "${l.title}":`, error.message);
    } else {
      insertedListings.push(data[0]);
      console.log(`   ✅ Listing: ${l.title} (${data[0].id})`);
    }
  }

  console.log(`\n   ${insertedListings.length} listings created.\n`);

  // Step 4: Add sample reviews
  console.log('⭐ Creating sample reviews...');
  if (insertedListings.length > 0 && usersMap['bob'] && usersMap['alice'] && usersMap['charlie']) {
    const firstListingId = insertedListings[0].id;

    const reviews = [
      {
        reviewer_id: usersMap['bob'],
        reviewee_id: usersMap['alice'],
        rating: 5,
        comment: 'Alice was extremely punctual and the couch was exactly as described. Highly recommended seller!',
        listing_id: firstListingId
      },
      {
        reviewer_id: usersMap['charlie'],
        reviewee_id: usersMap['alice'],
        rating: 4,
        comment: 'Smooth trade near City Hall. Good communication.',
        listing_id: firstListingId
      }
    ];

    for (const review of reviews) {
      const { error } = await supabase.from('reviews').insert(review);
      if (error) {
        console.error(`   ❌ Review insert error:`, error.message);
      } else {
        console.log(`   ✅ Review added`);
      }
    }

    // Update Alice's ratings
    await supabase.from('users')
      .update({ rating_avg: 4.5, reviews_count: 2 })
      .eq('id', usersMap['alice']);
  }

  console.log('\n🎉 Database seeding complete!');
  console.log('\n📋 Test Credentials (all passwords: password123):');
  console.log('   alice@example.com  |  bob@example.com  |  charlie@example.com');
  console.log('   dave@example.com   |  eve@example.com');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
