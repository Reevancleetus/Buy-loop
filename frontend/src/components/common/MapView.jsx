import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issues in Vite/Webpack environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const purpleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MapView = ({
  center = [40.7128, -74.0060], // default NYC
  zoom = 13,
  listings = [],
  selectionMode = false,
  onLocationSelect = null,
  userLocation = null,
  height = '400px'
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const selectionMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const listingMarkersRef = useRef([]);

  // Extract coordinates for stable dependencies
  const centerLat = center[0];
  const centerLng = center[1];
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  // 1. Initialize Map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
    });

    // Add OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // If selection mode, add click listener and initial marker
    if (selectionMode) {
      const marker = L.marker([centerLat, centerLng], {
        icon: redIcon,
        draggable: true
      }).addTo(map);

      selectionMarkerRef.current = marker;

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        if (onLocationSelect) {
          onLocationSelect({ lat: position.lat, lng: position.lng });
        }
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        if (onLocationSelect) {
          onLocationSelect({ lat, lng });
        }
      });
    }

    // Trigger a resize on next tick to ensure the map renders correctly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      // Cleanup map instance
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.remove();
        selectionMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (userCircleRef.current) {
        userCircleRef.current.remove();
        userCircleRef.current = null;
      }
      listingMarkersRef.current.forEach(m => m.remove());
      listingMarkersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [selectionMode]); // Re-initialize only if mode changes

  // 2. Handle center updates dynamically without rebuilding the map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.panTo([centerLat, centerLng]);

    // Update selection marker position if it exists
    if (selectionMode && selectionMarkerRef.current) {
      selectionMarkerRef.current.setLatLng([centerLat, centerLng]);
    }
  }, [centerLat, centerLng, selectionMode]);

  // 3. Handle user current location marker updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old user marker and circle
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userCircleRef.current) {
      userCircleRef.current.remove();
      userCircleRef.current = null;
    }

    if (userLat && userLng) {
      // Create user marker
      const marker = L.marker([userLat, userLng], {
        zIndexOffset: 1000
      }).addTo(map);
      
      marker.bindPopup('<b style="font-family: inherit; color: #1a73e8;">Your Current Location (Center)</b>').openPopup();
      userMarkerRef.current = marker;

      // Add circle around user location
      const circle = L.circle([userLat, userLng], {
        radius: 200,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        color: '#3b82f6',
        opacity: 0.4,
        weight: 1
      }).addTo(map);
      userCircleRef.current = circle;
    }
  }, [userLat, userLng]);

  // 4. Handle listing markers updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing listing markers
    listingMarkersRef.current.forEach(m => m.remove());
    listingMarkersRef.current = [];

    // Add new markers
    listings.forEach(listing => {
      if (!listing.lat || !listing.lng) return;

      const marker = L.marker([listing.lat, listing.lng], {
        icon: purpleIcon
      }).addTo(map);

      listingMarkersRef.current.push(marker);

      const imageUrl = listing.image_urls && listing.image_urls.length > 0
        ? (listing.image_urls[0].startsWith('http') ? listing.image_urls[0] : `http://localhost:3000${listing.image_urls[0]}`)
        : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200&auto=format&fit=crop&q=60';

      const popupHtml = `
        <div style="font-family: inherit; max-width: 220px; padding: 4px;">
          <img src="${imageUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700;">${listing.title}</h4>
          <p style="margin: 0 0 6px 0; color: #6366f1; font-weight: 700; font-size: 14px;">₹${listing.price}</p>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b;">${listing.distance !== null ? `${listing.distance} km away` : ''}</p>
          <button class="map-view-btn" id="map-btn-${listing.id}" style="
            width: 100%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
          ">View Details</button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`map-btn-${listing.id}`);
        if (btn) {
          btn.onclick = () => {
            const event = new CustomEvent('view-listing-details', { detail: listing.id });
            window.dispatchEvent(event);
          };
        }
      });
    });
  }, [listings]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        height,
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        zIndex: 1
      }}
    />
  );
};

export default MapView;
