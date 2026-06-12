import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MapView from '../components/common/MapView';
import { supabase } from '../supabaseClient';

const CATEGORIES = ['Electronics', 'Furniture', 'Clothing', 'Books', 'Outdoors', 'Sports', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const CreateListing = ({ onListingCreated }) => {
  const { user, token, simulatedLocation } = useContext(AuthContext);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [address, setAddress] = useState(simulatedLocation.address);
  const [coords, setCoords] = useState({ lat: simulatedLocation.lat, lng: simulatedLocation.lng });
  const [files, setFiles] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);

    // Create previews
    const previews = selectedFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleMapSelect = (newCoords) => {
    setCoords(newCoords);
    // Auto-update address to custom coordinates to show they picked something custom
    setAddress(`Meetup Area (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !price || !address) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!user) {
      setError('You must be logged in to create a listing.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const uploadedUrls = [];

      // 1. Upload files to Supabase Storage bucket 'listings'
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('listings')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.warn('Storage upload failed. Make sure a public bucket named "listings" exists in Supabase. Error:', uploadError);
          throw new Error(`Failed to upload image ${file.name}. Please ensure a public bucket named "listings" exists in Supabase. Details: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('listings')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      // 2. Insert listing record into PostgreSQL listings table
      const { data, error: insertError } = await supabase
        .from('listings')
        .insert([
          {
            user_id: user.id,
            title,
            description,
            category,
            price: parseFloat(price),
            condition,
            image_urls: uploadedUrls,
            lat: parseFloat(coords.lat),
            lng: parseFloat(coords.lng),
            address
          }
        ]);

      if (insertError) throw insertError;

      onListingCreated();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Connection error submitting listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '20px' }}>List an Item for Sale</h2>

      {error && (
        <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textTransform: 'none' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Title & Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Item Title *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. iPhone 13 Pro 256GB"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Price (₹) *</label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 450"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Category & Condition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Category *</label>
            <select
              className="input-field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Condition *</label>
            <select
              className="input-field"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              {CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Description *</label>
          <textarea
            className="input-field"
            rows="5"
            placeholder="Describe your item's condition, features, packaging, reason for selling, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ resize: 'vertical' }}
            required
          ></textarea>
        </div>

        {/* Image Uploads */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Item Images (Up to 5)</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="image-upload-input"
          />
          <label
            htmlFor="image-upload-input"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', padding: '12px 24px', cursor: 'pointer', border: '2px dashed var(--border-color)' }}
          >
            📸 Choose Photos
          </label>

          {imagePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {imagePreviews.map((preview, i) => (
                <img
                  key={i}
                  src={preview}
                  alt=""
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hyperlocal location selection */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '16px' }}>Meetup Location *</label>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Choose where you want to meet buyers (e.g. coffee shop, train station, park). <b>Do not use your exact house number to maintain privacy!</b>
          </p>

          <input
            type="text"
            className="input-field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address description (e.g. Starbucks, Main St.)"
            style={{ marginBottom: '12px' }}
            required
          />

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Location Coordinates: <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          </div>

          <MapView
            center={[coords.lat, coords.lng]}
            zoom={13}
            selectionMode={true}
            onLocationSelect={handleMapSelect}
            height="250px"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '14px', width: '100%' }}
          disabled={submitting}
        >
          {submitting ? 'Creating listing...' : 'Publish Listing'}
        </button>

      </form>
    </div>
  );
};

export default CreateListing;
