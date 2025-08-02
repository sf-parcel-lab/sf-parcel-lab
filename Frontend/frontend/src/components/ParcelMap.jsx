import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './ParcelMap.css';

// Component to handle map events and API calls
const MapEventHandler = ({ onBoundsChange, onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Notify parent that map is ready
    onMapReady(map);

    // Handle initial load and map movement
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    };

    // Trigger initial load
    handleMoveEnd();

    // Listen for map movement
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, onBoundsChange, onMapReady]);

  return null;
};

const ParcelMap = () => {
  // State management
  const [parcelData, setParcelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [currentFilters, setCurrentFilters] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  // Refs
  const mapRef = useRef(null);
  const geoJsonLayerRef = useRef(null);

  // San Francisco coordinates
  const SF_CENTER = [37.7749, -122.4194];
  const SF_ZOOM = 13;

  // API endpoints
  const API_BASE = 'http://localhost:5000'; // Adjust as needed
  const BBOX_ENDPOINT = `${API_BASE}/bbox`;
  const LLM_QUERY_ENDPOINT = `${API_BASE}/llm_query`;
  const PARCELS_ENDPOINT = `${API_BASE}/parcels`;

  // Zoning color mapping
  const getZoningColor = (zoning) => {
    if (!zoning) return '#cccccc';
    
    const zone = zoning.toUpperCase();
    
    if (zone.startsWith('RM-')) return '#4A90E2';
    if (zone.startsWith('RH-')) return '#7ED321';
    if (zone.startsWith('RTO-')) return '#50E3C2';
    if (zone.startsWith('C-')) return '#D0021B';
    if (zone.startsWith('M-')) return '#F5A623';
    if (zone.startsWith('MIXED')) return '#9013FE';
    if (zone.startsWith('PDR-')) return '#8B572A';
    
    return '#9B9B9B';
  };

  // PART 1: Load parcels based on bounding box
  const loadParcelsByBounds = useCallback(async (bounds) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west
      });

      const response = await fetch(`${BBOX_ENDPOINT}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load parcels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Loaded parcels by bounds:', data.features?.length || 0, 'features');
      
      setParcelData(data);
      setDebugInfo(`Loaded ${data.features?.length || 0} parcels in current view`);
      
    } catch (err) {
      console.error('Error loading parcels by bounds:', err);
      setError('⚠️ Failed to load parcels in view');
      setParcelData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // PART 2: LLM query processing
  const processLLMQuery = async (query) => {
    try {
      setSearchLoading(true);
      setSearchError(null);
      
      const response = await fetch(LLM_QUERY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: query })
      });
      
      if (!response.ok) {
        throw new Error(`LLM query failed: ${response.status} ${response.statusText}`);
      }
      
      const filters = await response.json();
      console.log('LLM query response:', filters);
      
      return filters;
      
    } catch (err) {
      console.error('Error processing LLM query:', err);
      setSearchError('⚠️ Could not interpret your query');
      return null;
    } finally {
      setSearchLoading(false);
    }
  };

  // PART 3: Parcel query with filters
  const loadParcelsByFilters = async (filters) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.zoning) params.append('zoning', filters.zoning);
      if (filters.neighborhood) params.append('neighborhood', filters.neighborhood);
      if (filters.flood_risk) params.append('flood_risk', filters.flood_risk);
      
      const response = await fetch(`${PARCELS_ENDPOINT}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load filtered parcels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Loaded filtered parcels:', data.features?.length || 0, 'features');
      
      if (!data.features || data.features.length === 0) {
        setError('⚠️ No parcels matched your search');
        setParcelData(null);
      } else {
        setParcelData(data);
        setCurrentFilters(filters);
        setDebugInfo(`Found ${data.features.length} parcels matching your search`);
      }
      
    } catch (err) {
      console.error('Error loading filtered parcels:', err);
      setError('⚠️ No parcels matched your search');
      setParcelData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const filters = await processLLMQuery(searchQuery);
    if (filters) {
      await loadParcelsByFilters(filters);
    }
  };

  // Handle map ready
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Handle bounds change
  const handleBoundsChange = useCallback((bounds) => {
    // Only load by bounds if no search filters are active
    if (!currentFilters) {
      loadParcelsByBounds(bounds);
    }
  }, [loadParcelsByBounds, currentFilters]);

  // Clear search and return to bounds-based loading
  const clearSearch = () => {
    setSearchQuery('');
    setCurrentFilters(null);
    setSearchError(null);
    setError(null);
    // Trigger bounds-based loading
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      handleBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  };

  // Style function for GeoJSON features
  const styleFeature = (feature) => {
    const zoning = feature.properties.zoning;
    const color = getZoningColor(zoning);
    
    return {
      fillColor: color,
      fillOpacity: 0.7,
      stroke: true,
      weight: 1,
      color: '#333333',
      opacity: 1.0
    };
  };

  // Handle feature click
  const onEachFeature = (feature, layer) => {
    const properties = feature.properties;
    
    const parcelId = properties.parcel_id || 'Unknown';
    const zoning = properties.zoning || 'Not specified';
    const landUse = properties.land_use || 'Not specified';
    const areaSqft = properties.area_sqft;
    
    const areaSqM = areaSqft ? (areaSqft * 0.0929).toFixed(1) : 'Unknown';
    
    const popupContent = `
      <div class="parcel-popup">
        <h3>Parcel ${parcelId}</h3>
        <p><strong>Zoning:</strong> ${zoning}</p>
        <p><strong>Land Use:</strong> ${landUse}</p>
        <p><strong>Area:</strong> ${areaSqM} m² (${areaSqft?.toFixed(0) || 'Unknown'} sq ft)</p>
      </div>
    `;
    
    layer.bindPopup(popupContent);
  };

  return (
    <div className="map-container">
      {/* Search bar with LLM integration */}
      <div className="search-bar">
        <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%' }}>
          <input 
            type="text" 
            placeholder="Search parcels by zoning, land use, or location..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={searchLoading}
          />
          <button 
            type="submit" 
            className="search-button"
            disabled={searchLoading}
          >
            {searchLoading ? '🔍' : '🔍'}
          </button>
        </form>
        {currentFilters && (
          <button 
            onClick={clearSearch}
            className="clear-search-button"
            style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Error messages */}
      {error && (
        <div className="error-message" style={{ 
          position: 'absolute', 
          top: '80px', 
          left: '10px', 
          background: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px', 
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          {error}
        </div>
      )}

      {searchError && (
        <div className="search-error" style={{ 
          position: 'absolute', 
          top: '80px', 
          right: '10px', 
          background: '#fff3e0', 
          color: '#ef6c00', 
          padding: '10px', 
          borderRadius: '4px', 
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          {searchError}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading parcels...</p>
        </div>
      )}

      {/* Debug info */}
      {debugInfo && (
        <div className="debug-info">
          <p>{debugInfo}</p>
          {currentFilters && (
            <p>Active filters: {Object.entries(currentFilters).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
          )}
        </div>
      )}

      {/* Map container */}
      <MapContainer 
        center={SF_CENTER} 
        zoom={SF_ZOOM} 
        className="map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map event handler */}
        <MapEventHandler 
          onBoundsChange={handleBoundsChange}
          onMapReady={handleMapReady}
        />

        {/* Parcel GeoJSON layer */}
        {parcelData && (
          <GeoJSON
            key={JSON.stringify(parcelData)} // Force re-render when data changes
            data={parcelData}
            style={styleFeature}
            onEachFeature={onEachFeature}
            ref={geoJsonLayerRef}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="map-legend">
        <h4>Zoning Colors</h4>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#4A90E2'}}></span>
          <span>RM-* (Residential Multi-Unit)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#7ED321'}}></span>
          <span>RH-* (Residential House)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#D0021B'}}></span>
          <span>C-* (Commercial)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#F5A623'}}></span>
          <span>M-* (Mixed Use)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#cccccc'}}></span>
          <span>No Zoning Data</span>
        </div>
      </div>
    </div>
  );
};

export default ParcelMap; 