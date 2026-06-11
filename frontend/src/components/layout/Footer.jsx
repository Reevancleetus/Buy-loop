import React from 'react';

const Footer = () => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '24px',
      color: 'var(--text-muted)',
      fontSize: '14px',
      borderTop: '1px solid var(--border-color)',
      marginTop: '40px',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      <p>© {new Date().getFullYear()} Buy-loop Hyperlocal Marketplace. All rights reserved.</p>
      <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
        Fostering trust and sustainability within local communities.
      </p>
    </footer>
  );
};

export default Footer;
