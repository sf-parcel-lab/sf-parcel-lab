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

  // Chatbot state
  const [messages, setMessages] = useState([]);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  // Refs
  const mapRef = useRef(null);
  const geoJsonLayerRef = useRef(null);

  // San Francisco coordinates
  const SF_CENTER = [37.7749, -122.4194];
  const SF_ZOOM = 13;

  // API endpoints
  const API_BASE = 'http://localhost:3001'; // Backend Express server
  const PARCELS_ENDPOINT = `${API_BASE}/api/parcels`;
  const LLM_QUERY_ENDPOINT = `${API_BASE}/api/query`;

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chargement initial des parcelles au montage
  useEffect(() => {
    const fetchInitialParcels = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(PARCELS_ENDPOINT);
        if (!response.ok) throw new Error('Erreur lors du chargement initial des parcelles');
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setParcelData(data);
          setDebugInfo(`Loaded ${data.features.length} parcels (initial)`);
        } else {
          setParcelData(null);
          setError('Aucune parcelle trouvée');
        }
      } catch (err) {
        setError('Erreur lors du chargement initial des parcelles');
        setParcelData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialParcels();
  }, []);

  // LLM Query Processing
  const processLLMQuery = async (query) => {
    try {
      setSearchLoading(true);
      setSearchError(null);
      
      const response = await fetch(LLM_QUERY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      
      if (!response.ok) {
        throw new Error(`LLM query failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (err) {
      console.error('Error processing LLM query:', err);
      setSearchError('⚠️ Could not interpret your query');
      return null;
    } finally {
      setSearchLoading(false);
    }
  };

  // Chat Message Handling
  const handleChatMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setSearchQuery('');
    setSearchLoading(true);
    setSearchError(null);

    try {
      const data = await processLLMQuery(message);
      
      if (data && data.data) {
        const botMessage = {
          id: Date.now() + 1,
          text: `Found ${data.data.length} parcels matching your query.`,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString(),
          data: data.data,
          queryUsed: data.query_used
        };

        setMessages(prev => [...prev, botMessage]);

        // Display results on map
        if (data.data.length > 0) {
          console.log('Sample parcel data:', data.data[0]); // Debug log
          
          const geoJsonData = {
            type: "FeatureCollection",
            features: data.data
              .filter(parcel => parcel.shape || parcel.geometry) // Only include parcels with geometry
              .map(parcel => ({
                type: "Feature",
                geometry: parcel.shape || parcel.geometry, // Use shape field from backend
                properties: parcel
              }))
          };
          
          console.log('Generated GeoJSON:', geoJsonData); // Debug log
          setParcelData(geoJsonData);
          setCurrentFilters(data.query_used);
          const validParcels = data.data.filter(parcel => parcel.shape || parcel.geometry).length;
          setDebugInfo(`Found ${data.data.length} parcels matching your query (${validParcels} with geometry)`);
        } else {
          setError('⚠️ No parcels matched your query');
          setParcelData(null);
        }
      }
    } catch (err) {
      console.error('Error in handleChatMessage:', err);
      setSearchError('⚠️ An error occurred while processing your query');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleChatMessage(searchQuery);
    }
  };

  // Clear search and chat
  const clearSearch = () => {
    setSearchQuery('');
    setMessages([]);
    setSearchError(null);
    setCurrentFilters(null);
    setDebugInfo('');
    // Reload initial parcels
    fetch(PARCELS_ENDPOINT)
      .then(response => response.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          setParcelData(data);
          setDebugInfo(`Loaded ${data.features.length} parcels (initial)`);
        }
      })
      .catch(err => {
        setError('Error reloading parcels');
      });
  };

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


  // Fonction simplifiée - pas de chargement par bounds pour l'instant
  const handleBoundsChange = useCallback((bounds) => {
    // Pour l'instant, on ne fait rien avec les bounds
    // Toutes les parcelles sont déjà chargées au démarrage
    console.log('Map bounds changed:', bounds);
  }, []);


  // Handle map ready
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);


  // Style function for GeoJSON features
  const styleFeature = (feature) => {
    const zoning = feature.properties.zoning_code || feature.properties.zoning_district;
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
    
    // Utiliser les vrais noms de champs de l'API
    const parcelId = properties.mapblklot || 'Unknown';
    const zoning = properties.zoning_code || 'Not specified';
    const zoningDistrict = properties.zoning_district || 'Not specified';
    const landUse = properties.land_use || 'Not specified';
    const areaSqft = properties.area_sqft;
    
    // Construire l'adresse complète
    const fromAddr = properties.from_address_num || '';
    const toAddr = properties.to_address_num || '';
    const streetName = properties.street_name || '';
    const streetType = properties.street_type || '';
    
    let address = 'Address not available';
    if (streetName && streetType) {
      if (fromAddr && toAddr && fromAddr !== toAddr) {
        address = `${fromAddr}-${toAddr} ${streetName} ${streetType}`;
      } else if (fromAddr) {
        address = `${fromAddr} ${streetName} ${streetType}`;
      } else {
        address = `${streetName} ${streetType}`;
      }
    }
    
    const areaSqM = areaSqft ? (areaSqft * 0.0929).toFixed(1) : 'Unknown';
    
    // Formatage de la date de mise à jour
    const updatedAt = properties.updated_at 
      ? new Date(properties.updated_at).toLocaleDateString('fr-FR')
      : 'Unknown';
    
    // Coordonnées du centroïde
    const lat = properties.centroid_latitude ? parseFloat(properties.centroid_latitude).toFixed(6) : 'N/A';
    const lng = properties.centroid_longitude ? parseFloat(properties.centroid_longitude).toFixed(6) : 'N/A';
    
    const popupContent = `
      <div class="parcel-popup" style="max-width: 350px; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
          📍 Parcel ${parcelId}
        </h3>
        
        <div style="margin-bottom: 8px;">
          <strong>🏠 Address:</strong> ${address}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>🏗️ Zoning:</strong> ${zoning}
          ${zoningDistrict !== 'Not specified' ? `<br><small style="color: #666;">${zoningDistrict}</small>` : ''}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>🏘️ Neighborhood:</strong> ${properties.analysis_neighborhood || 'Not specified'}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>🗺️ Planning District:</strong> ${properties.planning_district || 'Not specified'}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>👮 Police District:</strong> ${properties.police_district || 'Not specified'}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>🏛️ Supervisor:</strong> ${properties.supname || 'Not specified'}
          ${properties.supervisor_district ? `<br><small style="color: #666;">District ${properties.supervisor_district}</small>` : ''}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>📐 Area:</strong> ${areaSqM} m² (${areaSqft?.toFixed(0) || 'Unknown'} sq ft)
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>🌱 Land Use:</strong> ${landUse}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>📊 Block/Lot:</strong> ${properties.blklot || 'N/A'}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong>📍 Coordinates:</strong> ${lat}, ${lng}
        </div>
        
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee; font-size: 11px; color: #666;">
          <strong>📅 Last Updated:</strong> ${updatedAt}
        </div>
      </div>
    `;
    
    layer.bindPopup(popupContent, {
      maxWidth: 400,
      className: 'custom-popup'
    });
  };

  return (
    <div className="map-container">

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

      {/* Search Bar with Chatbot */}
      <div className={`search-bar ${isChatExpanded ? 'chat-expanded' : ''}`}>
        <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%' }}>
          <input
            type="text"
            placeholder="Ask about SF parcels... (e.g., 'Show me residential properties in Ingleside')"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={searchLoading}
          />
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="search-button"
          >
            {searchLoading ? '⏳' : '➤'}
          </button>
          <button
            type="button"
            className="chat-toggle-button"
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            title={isChatExpanded ? 'Collapse chat' : 'Expand chat'}
          >
            {isChatExpanded ? '−' : '💬'}
          </button>
          <button
            type="button"
            className="clear-button"
            onClick={clearSearch}
            title="Clear search"
          >
            🗑️
          </button>
        </form>

        {/* Chat Messages */}
        {isChatExpanded && (
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>👋 Hi! I'm your SF Parcel Assistant.</p>
                <p>Ask me about:</p>
                <ul>
                  <li>• Properties in specific neighborhoods</li>
                  <li>• Zoning types (residential, commercial, etc.)</li>
                  <li>• Two-family homes or mixed-use buildings</li>
                  <li>• Properties in specific districts</li>
                </ul>
                <p>Try: "Show me residential properties in Ingleside"</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender} ${message.isError ? 'error' : ''}`}
              >
                <div className="message-content">
                  <div className="message-text">{message.text}</div>
                  {message.data && message.data.length > 0 && (
                    <div className="message-results">
                      <div className="results-summary">
                        <strong>Results:</strong> {message.data.length} parcels found
                      </div>
                      {message.queryUsed && (
                        <details className="query-details">
                          <summary>View Query Used</summary>
                          <pre>{JSON.stringify(message.queryUsed, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                  <div className="message-timestamp">{message.timestamp}</div>
                </div>
              </div>
            ))}

            {searchLoading && (
              <div className="message bot loading">
                <div className="message-content">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            {searchError && (
              <div className="error-message">
                {searchError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

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