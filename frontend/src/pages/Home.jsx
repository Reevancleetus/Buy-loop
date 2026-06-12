import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { supabase } from '../supabaseClient';

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Clothing', 'Books', 'Outdoors', 'Sports', 'Other'];

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

const Home = ({ onViewDetails }) => {
  const { simulatedLocation } = useContext(AuthContext);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState(10); // default 10km
  const [sort, setSort] = useState('distance');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch listings from Supabase
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError('');
      try {
        let query = supabase
          .from('listings')
          .select('*, users!inner(username, rating_avg, reviews_count)')
          .eq('status', 'active');

        // Filter by category
        if (category && category !== 'All') {
          query = query.eq('category', category);
        }

        // Filter by search query (case-insensitive title or description)
        if (search) {
          query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Process listings: flatten user details and compute distances
        const userLat = simulatedLocation.lat;
        const userLng = simulatedLocation.lng;

        let processedListings = (data || []).map(item => {
          const distance = userLat !== null && userLng !== null
            ? calculateDistance(userLat, userLng, item.lat, item.lng)
            : null;

          return {
            ...item,
            username: item.users?.username || 'Unknown User',
            rating_avg: item.users?.rating_avg || 0,
            reviews_count: item.users?.reviews_count || 0,
            distance
          };
        });

        // Filter by radius if coordinates and radius are provided
        if (userLat !== null && userLng !== null && radius !== 'all') {
          const radiusKm = parseFloat(radius);
          processedListings = processedListings.filter(listing => listing.distance !== null && listing.distance <= radiusKm);
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

        setListings(processedListings);
      } catch (err) {
        console.error('Error fetching listings:', err);
        setError('Error fetching listings from database.');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search slightly to avoid excessive API requests
    const delayDebounce = setTimeout(() => {
      fetchListings();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [simulatedLocation, radius, category, search, sort]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Search & Location Summary Header */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search items by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }}>🔍</span>
          </div>
          
          {/* Sorting */}
          <div style={{ minWidth: '180px' }}>
            <select
              className="input-field"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="distance">Sort by: Nearest</option>
              <option value="date_desc">Sort by: Newest</option>
              <option value="price_asc">Sort by: Price (Low to High)</option>
              <option value="price_desc">Sort by: Price (High to Low)</option>
            </select>
          </div>

          {/* Grid/Map Toggle */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '10px 16px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                backgroundColor: viewMode === 'grid' ? 'var(--primary)' : 'var(--bg-secondary)',
                color: viewMode === 'grid' ? 'white' : 'var(--text-primary)'
              }}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{
                padding: '10px 16px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                backgroundColor: viewMode === 'map' ? 'var(--primary)' : 'var(--bg-secondary)',
                color: viewMode === 'map' ? 'white' : 'var(--text-primary)'
              }}
            >
              Map View
            </button>
          </div>
        </div>

        {/* Hyperlocal radius search slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
              <span>Search Radius</span>
              <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                {radius === 'all' ? 'Worldwide (Unlimited)' : `${radius} km`}
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={radius === 'all' ? 50 : radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>1 km</span>
              <span>10 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
          </div>
          
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setRadius('all')}
            style={{
              alignSelf: 'end',
              backgroundColor: radius === 'all' ? 'var(--primary-light)' : 'var(--bg-tertiary)',
              borderColor: radius === 'all' ? 'var(--primary)' : 'var(--border-color)',
              color: radius === 'all' ? 'var(--primary)' : 'var(--text-primary)'
            }}
          >
            Show All Distances
          </button>
        </div>
      </div>

      {/* Category selection */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'thin'
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className="btn btn-secondary btn-sm"
            style={{
              borderRadius: '9999px',
              padding: '8px 16px',
              whiteSpace: 'nowrap',
              backgroundColor: category === cat ? 'var(--primary)' : 'var(--bg-secondary)',
              color: category === cat ? '#white' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: category === cat ? '0 4px 10px rgba(99,102,241,0.2)' : 'none'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Results area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🔄</div>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Scanning nearby listings...</p>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
          <p>⚠️ {error}</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '48px' }}>📍</span>
          <h3 style={{ margin: '16px 0 8px 0', fontWeight: '700' }}>No listings found nearby</h3>
          <p style={{ maxWidth: '400px', margin: '0 auto', fontSize: '14px', color: 'var(--text-muted)' }}>
            Try increasing your search radius or changing your simulated location in the navigation bar to see listings in other regions.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="product-grid">
          {listings.map(item => {
            const hasImage = item.image_urls && item.image_urls.length > 0;
            const imgUrl = hasImage
              ? (item.image_urls[0].startsWith('http') ? item.image_urls[0] : `http://localhost:3000${item.image_urls[0]}`)
              : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&auto=format&fit=crop&q=60';

            return (
              <div
                key={item.id}
                onClick={() => onViewDetails(item.id)}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                  border: '1px solid var(--border-color)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px var(--glass-shadow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Photo container */}
                <div style={{ position: 'relative', height: '200px', width: '100%', overflow: 'hidden' }}>
                  <img
                    src={imgUrl}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Proximity tag badge overlay */}
                  <span className="badge badge-distance" style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 2 }}>
                    📍 {item.distance !== null ? `${item.distance} km` : 'Local'}
                  </span>
                  
                  {/* Condition badge */}
                  <span className="badge badge-condition" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
                    {item.condition}
                  </span>
                </div>

                {/* Details */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {item.category}
                  </span>
                  
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>
                      ₹{item.price.toFixed(2)}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '4px 0 8px 0' }}>
                    {item.description}
                  </p>

                  {/* Seller details & reviews */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>👤 {item.username}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: 'var(--warning)' }}>★</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.rating_avg.toFixed(1)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({item.reviews_count})</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '16px', height: '550px' }}>
          <MapView
            center={[simulatedLocation.lat, simulatedLocation.lng]}
            zoom={12}
            listings={listings}
            userLocation={simulatedLocation}
            height="100%"
          />
        </div>
      )}
    </div>
  );
};

export default Home;
