import { createClient } from '@supabase/supabase-js';

// Get configuration from environment variables or localStorage overrides
const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');

  if (localUrl && localKey) {
    return { url: localUrl, key: localKey, isMock: false };
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const isPlaceholder =
    !envUrl ||
    !envKey ||
    envUrl.includes('your-project-id') ||
    envKey.includes('your-anon-key');

  if (isPlaceholder) {
    return { url: '', key: '', isMock: true };
  }

  return { url: envUrl, key: envKey, isMock: false };
};

const config = getSupabaseConfig();

// Mock database simulation engine
const initMockDB = () => {
  if (!localStorage.getItem('mock_users')) {
    localStorage.setItem(
      'mock_users',
      JSON.stringify([
        {
          id: 'seller-1',
          username: 'alice_green',
          email: 'alice@example.com',
          lat: 40.758,
          lng: -73.9855,
          address: 'Times Square, NY',
          rating_avg: 4.8,
          reviews_count: 12,
        },
        {
          id: 'seller-2',
          username: 'bob_tech',
          email: 'bob@example.com',
          lat: 40.7829,
          lng: -73.9654,
          address: 'Central Park (Midtown), NY',
          rating_avg: 4.5,
          reviews_count: 5,
        },
      ])
    );
  }

  if (!localStorage.getItem('mock_listings')) {
    localStorage.setItem(
      'mock_listings',
      JSON.stringify([
        {
          id: 1,
          title: 'Vintage Cruiser Bicycle',
          description:
            'A beautiful retro cruiser bicycle in excellent condition. Perfect for riding around Central Park or the city streets. Comes with a front basket and a bell.',
          price: 150,
          lat: 40.7829,
          lng: -73.9654,
          address: 'Central Park (Midtown), NY',
          category: 'Sports & Outdoors',
          image_urls: [
            'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop&q=60',
          ],
          seller_id: 'seller-2',
          status: 'available',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        },
        {
          id: 2,
          title: 'MacBook Pro M1 (13-inch, 2020)',
          description:
            'Super fast Apple M1 MacBook Pro with 8GB RAM and 256GB SSD storage. Battery health is at 92%. In pristine condition, zero scratches. Box and original charger included.',
          price: 650,
          lat: 40.758,
          lng: -73.9855,
          address: 'Times Square, NY',
          category: 'Electronics',
          image_urls: [
            'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=60',
          ],
          seller_id: 'seller-1',
          status: 'available',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        },
        {
          id: 3,
          title: 'Comfortable Leather Loveseat Sofa',
          description:
            'Mid-century modern leather sofa. Very comfortable, minor wear on the cushions, but otherwise in fantastic shape. Must pick up from the apartment.',
          price: 280,
          lat: 40.7061,
          lng: -73.9969,
          address: 'Brooklyn Bridge Park, NY',
          category: 'Furniture',
          image_urls: [
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=60',
          ],
          seller_id: 'seller-1',
          status: 'available',
          created_at: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
        },
      ])
    );
  }

  if (!localStorage.getItem('mock_chats')) {
    localStorage.setItem('mock_chats', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_messages')) {
    localStorage.setItem('mock_messages', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_transactions')) {
    localStorage.setItem('mock_transactions', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_reviews')) {
    localStorage.setItem('mock_reviews', JSON.stringify([]));
  }
  if (!localStorage.getItem('mock_meetups')) {
    localStorage.setItem('mock_meetups', JSON.stringify([]));
  }
};

if (config.isMock) {
  initMockDB();
}

// Real-time message subscription pool
const messageCallbacks = [];

const triggerMessageSubscription = (msg) => {
  messageCallbacks.forEach((cb) => {
    cb({
      eventType: 'INSERT',
      new: msg,
    });
  });
};

class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.data = JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
    this.filters = [];
    this.orderConfig = null;
    this.limitVal = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.orFilter = null;
    this.selectQuery = '*';
  }

  select(queryStr = '*') {
    this.selectQuery = queryStr;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  or(filterString) {
    this.orFilter = filterString; // e.g. "buyer_id.eq.xxx,seller_id.eq.xxx"
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderConfig = { field, ascending };
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  async execute() {
    try {
      let result = [...this.data];

      // Apply OR filters (e.g. buyer_id.eq.xxx,seller_id.eq.xxx)
      if (this.orFilter) {
        const parts = this.orFilter.split(',');
        result = result.filter((item) => {
          return parts.some((part) => {
            const match = part.match(/(\w+)\.eq\.(.+)/);
            if (match) {
              const [_, field, val] = match;
              return String(item[field]) === String(val);
            }
            return false;
          });
        });
      }

      // Apply EQ filters
      for (const filter of this.filters) {
        result = result.filter(
          (item) => String(item[filter.field]) === String(filter.value)
        );
      }

      // Apply Joins / Expansion
      if (this.selectQuery && this.selectQuery.includes('seller:users')) {
        const users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        result = result.map((item) => {
          const seller = users.find((u) => u.id === item.seller_id);
          return { ...item, seller };
        });
      }

      if (this.selectQuery && this.selectQuery.includes('buyer:users')) {
        const users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        const listings = JSON.parse(
          localStorage.getItem('mock_listings') || '[]'
        );
        result = result.map((item) => {
          const buyer = users.find((u) => u.id === item.buyer_id);
          const seller = users.find((u) => u.id === item.seller_id);
          const listing = listings.find((l) => l.id === item.listing_id);
          return {
            ...item,
            buyer,
            seller,
            listings: listing,
          };
        });
      }

      // Order
      if (this.orderConfig) {
        const { field, ascending } = this.orderConfig;
        result.sort((a, b) => {
          if (a[field] < b[field]) return ascending ? -1 : 1;
          if (a[field] > b[field]) return ascending ? 1 : -1;
          return 0;
        });
      }

      // Limit
      if (this.limitVal) {
        result = result.slice(0, this.limitVal);
      }

      if (this.isSingle) {
        if (result.length === 0) {
          throw new Error('Row not found');
        }
        return { data: result[0], error: null };
      }

      if (this.isMaybeSingle) {
        return { data: result[0] || null, error: null };
      }

      return { data: result, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async insert(row) {
    try {
      const rows = Array.isArray(row) ? row : [row];
      const newRows = rows.map((r) => {
        const id = r.id || Math.floor(Math.random() * 1000000);
        return {
          id,
          created_at: new Date().toISOString(),
          ...r,
        };
      });

      this.data.push(...newRows);
      localStorage.setItem(`mock_${this.table}`, JSON.stringify(this.data));

      // Real-time chat notification triggers
      if (this.table === 'messages') {
        newRows.forEach((msg) => {
          triggerMessageSubscription(msg);
        });
      }

      return {
        data: Array.isArray(row) ? newRows : newRows[0],
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async update(updateData) {
    try {
      let updatedRows = [];

      this.data = this.data.map((item) => {
        let matches = true;
        for (const filter of this.filters) {
          if (String(item[filter.field]) !== String(filter.value)) {
            matches = false;
            break;
          }
        }

        if (matches) {
          const updatedItem = { ...item, ...updateData };
          updatedRows.push(updatedItem);
          return updatedItem;
        }
        return item;
      });

      localStorage.setItem(`mock_${this.table}`, JSON.stringify(this.data));
      return { data: updatedRows, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async delete() {
    try {
      this.data = this.data.filter((item) => {
        let matches = true;
        for (const filter of this.filters) {
          if (String(item[filter.field]) !== String(filter.value)) {
            matches = false;
            break;
          }
        }
        return !matches;
      });

      localStorage.setItem(`mock_${this.table}`, JSON.stringify(this.data));
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
}

class MockChannel {
  constructor(name) {
    this.name = name;
    this.callback = null;
  }

  on(type, filter, callback) {
    this.callback = callback;
    return this;
  }

  subscribe() {
    if (this.callback) {
      const listener = (payload) => {
        this.callback(payload);
      };
      this.listener = listener;
      messageCallbacks.push(listener);
    }
    return this;
  }

  unsubscribe() {
    const idx = messageCallbacks.indexOf(this.listener);
    if (idx !== -1) {
      messageCallbacks.splice(idx, 1);
    }
  }
}

// Full simulated Supabase client object
const createMockSupabase = () => {
  return {
    from: (table) => new MockQueryBuilder(table),
    channel: (name) => new MockChannel(name),
    removeChannel: (channel) => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, file) => {
          const localUrl = URL.createObjectURL(file);
          if (!window.mockUploadedUrls) {
            window.mockUploadedUrls = {};
          }
          window.mockUploadedUrls[path] = localUrl;
          return { data: { path }, error: null };
        },
        getPublicUrl: (path) => {
          const publicUrl =
            (window.mockUploadedUrls && window.mockUploadedUrls[path]) ||
            'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&fit=crop&q=60';
          return { data: { publicUrl } };
        },
      }),
    },
    auth: {
      getSession: async () => {
        const sessionStr = localStorage.getItem('mock_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        return { data: { session }, error: null };
      },
      onAuthStateChange: (callback) => {
        const sessionStr = localStorage.getItem('mock_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        setTimeout(() => {
          callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        }, 10);

        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },
      signUp: async ({ email, password }) => {
        const users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        const existing = users.find((u) => u.email === email);
        if (existing) {
          return { data: { user: null }, error: { message: 'User already exists' } };
        }

        const id = 'user-' + Math.floor(Math.random() * 1000000);
        const user = { id, email };
        const session = {
          access_token: 'mock-jwt-token-' + id,
          user,
        };

        // Note: The public user details row is inserted in AuthContext
        localStorage.setItem('mock_session', JSON.stringify(session));
        return { data: { user }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        const users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        const dbUser = users.find((u) => u.email === email || u.username === email);
        if (!dbUser) {
          return { data: { user: null }, error: { message: 'Invalid credentials' } };
        }

        const user = { id: dbUser.id, email: dbUser.email };
        const session = {
          access_token: 'mock-jwt-token-' + dbUser.id,
          user,
        };

        localStorage.setItem('mock_session', JSON.stringify(session));
        return { data: { user }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('mock_session');
        return { error: null };
      },
      signInWithOAuth: async ({ provider, options }) => {
        // Mock Google oauth signin
        const users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        let googleUser = users.find((u) => u.username === 'google_user');
        
        if (!googleUser) {
          googleUser = {
            id: 'google-user-id',
            username: 'google_user',
            email: 'google@gmail.com',
            lat: 40.7128,
            lng: -74.006,
            address: 'NYC City Hall, NY (Google Account)',
            rating_avg: 5.0,
            reviews_count: 1,
          };
          users.push(googleUser);
          localStorage.setItem('mock_users', JSON.stringify(users));
        }

        const session = {
          access_token: 'mock-jwt-google-token',
          user: { id: googleUser.id, email: googleUser.email },
        };

        localStorage.setItem('mock_session', JSON.stringify(session));
        
        if (options && options.redirectTo) {
          window.location.reload();
        }
        return { error: null };
      },
    },
  };
};

export const supabase = config.isMock
  ? createMockSupabase()
  : createClient(config.url, config.key);
export const isMockDatabase = config.isMock;
