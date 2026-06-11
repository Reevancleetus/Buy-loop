import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Helper function to hash password with SHA-256 for public profile storage
const hashPasswordSHA256 = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulated location for hyperlocal calculation
  const [simulatedLocation, setSimulatedLocation] = useState({
    lat: 40.7128,
    lng: -74.0060,
    address: 'NYC City Hall, NY'
  });

  // Fetch and sync public user profile details
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching public user profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      return null;
    }
  };

  useEffect(() => {
    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession) {
        fetchProfile(activeSession.user.id).then(profile => {
          if (profile) {
            setUser(profile);
            setSimulatedLocation({
              lat: profile.lat,
              lng: profile.lng,
              address: profile.address
            });
          }
        });
      }
      setLoading(false);
    });

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        const profile = await fetchProfile(newSession.user.id);
        if (profile) {
          setUser(profile);
          setSimulatedLocation({
            lat: profile.lat,
            lng: profile.lng,
            address: profile.address
          });
        }
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (loginIdentifier, password) => {
    try {
      let emailToUse = loginIdentifier;
      
      // If the identifier doesn't look like an email, assume it's a username and fetch email
      if (!loginIdentifier.includes('@')) {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('username', loginIdentifier)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No user found with this username');
        emailToUse = data.email;
      }

      // Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });

      if (authError) throw authError;

      // Fetch public profile
      const profile = await fetchProfile(authData.user.id);
      if (!profile) throw new Error('Profile record not found in database');

      setUser(profile);
      setSimulatedLocation({
        lat: profile.lat,
        lng: profile.lng,
        address: profile.address
      });

      return profile;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const register = async (username, email, password, lat, lng, address) => {
    try {
      // 1. Sign up user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign up failed - no user returned');

      const userLat = lat !== undefined ? parseFloat(lat) : 40.7128;
      const userLng = lng !== undefined ? parseFloat(lng) : -74.0060;
      const userAddress = address || 'NYC City Hall, NY';

      // Hash password for public profile storage
      const passwordHash = await hashPasswordSHA256(password);

      // 2. Insert corresponding record into public.users table
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username,
          email,
          password_hash: passwordHash,
          lat: userLat,
          lng: userLng,
          address: userAddress,
          rating_avg: 0.0,
          reviews_count: 0
        });

      if (profileError) throw profileError;

      const profile = {
        id: authData.user.id,
        username,
        email,
        password_hash: passwordHash,
        lat: userLat,
        lng: userLng,
        address: userAddress,
        rating_avg: 0.0,
        reviews_count: 0
      };

      setUser(profile);
      setSimulatedLocation({
        lat: userLat,
        lng: userLng,
        address: userAddress
      });

      return profile;
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateSimulatedLocation = async (lat, lng, address) => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const updated = { lat: parsedLat, lng: parsedLng, address };
    setSimulatedLocation(updated);

    // If logged in, persist the location to the public.users database profile
    if (user) {
      try {
        const { error } = await supabase
          .from('users')
          .update(updated)
          .eq('id', user.id);

        if (error) throw error;
        setUser(prev => ({ ...prev, ...updated }));
      } catch (err) {
        console.error('Failed to update persisted location in Supabase:', err);
      }
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google Sign In Error:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: session?.access_token || null, // Export session token for compatibility if needed
        session,
        loading,
        simulatedLocation,
        login,
        loginWithGoogle,
        register,
        logout,
        updateSimulatedLocation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
