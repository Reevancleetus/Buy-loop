import React, { useEffect, useRef, useCallback } from 'react';

// Global script loader to avoid duplicate loads
let googleMapsLoadPromise = null;

function loadGoogleMaps() {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  if (window.google && window.google.maps) return Promise.resolve();

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&callback=__googleMapsInit`;
    script.async = true;
    script.defer = true;

    window.__googleMapsInit = () => {
      delete window.__googleMapsInit;
      resolve();
    };

    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

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
  const listingMarkersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Extract coordinates for stable dependencies
  const centerLat = center[0];
  const centerLng = center[1];
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  // 1. Initialize Map once on mount
  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      try {
        await loadGoogleMaps();
      } catch (err) {
        console.error('Google Maps failed to load:', err);
        return;
      }

      if (cancelled || !mapContainerRef.current) return;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom,
        mapId: 'buyloop-map',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            stylers: [{ visibility: 'simplified' }]
          }
        ]
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      isInitializedRef.current = true;

      // If selection mode, add click listener and initial marker
      if (selectionMode) {
        const marker = new google.maps.Marker({
          position: { lat: centerLat, lng: centerLng },
          map,
          draggable: true,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(40, 40)
          },
          animation: google.maps.Animation.DROP
        });

        selectionMarkerRef.current = marker;

        marker.addListener('dragend', () => {
          const position = marker.getPosition();
          if (onLocationSelect) {
            onLocationSelect({ lat: position.lat(), lng: position.lng() });
          }
        });

        map.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition({ lat, lng });
          if (onLocationSelect) {
            onLocationSelect({ lat, lng });
          }
        });
      }
    };

    initMap();

    return () => {
      cancelled = true;
      // Cleanup markers
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.setMap(null);
        selectionMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      listingMarkersRef.current.forEach(m => m.setMap(null));
      listingMarkersRef.current = [];
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      mapInstanceRef.current = null;
      isInitializedRef.current = false;
    };
  }, [selectionMode]); // Re-initialize only if mode changes

  // 2. Handle center updates dynamically without rebuilding the map
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitializedRef.current) return;

    mapInstanceRef.current.panTo({ lat: centerLat, lng: centerLng });

    // Update selection marker position if it exists
    if (selectionMode && selectionMarkerRef.current) {
      selectionMarkerRef.current.setPosition({ lat: centerLat, lng: centerLng });
    }
  }, [centerLat, centerLng, selectionMode]);

  // 3. Handle user current location marker updates
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitializedRef.current) return;

    // Remove old user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    if (userLat && userLng) {
      const marker = new google.maps.Marker({
        position: { lat: userLat, lng: userLng },
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 10
        },
        title: 'Your Current Location (Center)',
        zIndex: 999
      });

      // Add a pulsing circle around user location
      new google.maps.Circle({
        map: mapInstanceRef.current,
        center: { lat: userLat, lng: userLng },
        radius: 200,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
        strokeColor: '#4285F4',
        strokeOpacity: 0.3,
        strokeWeight: 1
      });

      const infoWindow = new google.maps.InfoWindow({
        content: '<b style="font-family: inherit; color: #1a73e8;">Your Current Location (Center)</b>'
      });

      infoWindow.open(mapInstanceRef.current, marker);
      userMarkerRef.current = marker;
    }
  }, [userLat, userLng]);

  // 4. Handle listing markers updates
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitializedRef.current) return;

    // Clear existing listing markers
    listingMarkersRef.current.forEach(m => m.setMap(null));
    listingMarkersRef.current = [];

    // Add new markers
    listings.forEach(listing => {
      if (!listing.lat || !listing.lng) return;

      const marker = new google.maps.Marker({
        position: { lat: listing.lat, lng: listing.lng },
        map: mapInstanceRef.current,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
          scaledSize: new google.maps.Size(36, 36)
        },
        animation: google.maps.Animation.DROP,
        title: listing.title
      });

      listingMarkersRef.current.push(marker);

      const imageUrl = listing.image_urls && listing.image_urls.length > 0
        ? (listing.image_urls[0].startsWith('http') ? listing.image_urls[0] : `http://localhost:3000${listing.image_urls[0]}`)
        : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200&auto=format&fit=crop&q=60';

      const popupHtml = `
        <div style="font-family: inherit; max-width: 220px; padding: 4px;">
          <img src="${imageUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700;">${listing.title}</h4>
          <p style="margin: 0 0 6px 0; color: #6366f1; font-weight: 700; font-size: 14px;">$${listing.price}</p>
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

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(popupHtml);
          infoWindowRef.current.open(mapInstanceRef.current, marker);

          // Wait for InfoWindow DOM to render, then bind button click
          google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
            const btn = document.getElementById(`map-btn-${listing.id}`);
            if (btn) {
              btn.onclick = () => {
                const event = new CustomEvent('view-listing-details', { detail: listing.id });
                window.dispatchEvent(event);
              };
            }
          });
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
