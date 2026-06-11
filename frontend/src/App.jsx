import React, { useState, useEffect, useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Auth from './pages/Auth';
import CreateListing from './pages/CreateListing';
import ProductDetails from './pages/ProductDetails';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

const AppContent = () => {
  const { user, loading } = useContext(AuthContext);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);

  // Catch custom Google Maps InfoWindow button clicks
  useEffect(() => {
    const handleViewListing = (e) => {
      const listingId = e.detail;
      setSelectedListingId(listingId);
      setCurrentPage('product-details');
    };

    window.addEventListener('view-listing-details', handleViewListing);
    return () => {
      window.removeEventListener('view-listing-details', handleViewListing);
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ fontSize: '48px', animation: 'spin 1.5s linear infinite' }}>🔄</div>
        <h2 style={{ marginTop: '20px', fontWeight: '700' }}>Initializing Buy-loop...</h2>
      </div>
    );
  }

  // Basic client-side page state selector routing
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home
            onViewDetails={(id) => {
              setSelectedListingId(id);
              setCurrentPage('product-details');
            }}
          />
        );
      case 'product-details':
        return (
          <ProductDetails
            listingId={selectedListingId}
            setCurrentPage={setCurrentPage}
            onBack={() => setCurrentPage('home')}
            onStartChat={(chatId) => {
              setActiveChatId(chatId);
              setCurrentPage('chat');
            }}
          />
        );
      case 'create-listing':
        return (
          <CreateListing
            onListingCreated={() => {
              setCurrentPage('home');
            }}
          />
        );
      case 'chat':
        return (
          <Chat
            initialActiveChatId={activeChatId}
          />
        );
      case 'profile':
        return (
          <Profile
            setCurrentPage={setCurrentPage}
          />
        );
      case 'auth':
        return (
          <Auth
            onAuthSuccess={() => {
              setCurrentPage('home');
            }}
          />
        );
      default:
        return <Home onViewDetails={(id) => { setSelectedListingId(id); setCurrentPage('product-details'); }} />;
    }
  };

  return (
    <div className="app-container">
      {/* Header Layout */}
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main Pages router viewport */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Footer Layout */}
      <Footer />
    </div>
  );
};

// Wrap core Content component in Providers so useContext resolves correctly
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
