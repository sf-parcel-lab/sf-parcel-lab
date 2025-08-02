# San Francisco Parcel Map - Frontend + Backend Integration

This project integrates a React + Leaflet frontend with a Flask backend to visualize and query San Francisco land parcels.

## 🚀 Quick Start

### 1. Backend Setup

First, set up the Flask backend:

```bash
# Install backend dependencies
pip install -r requirements.txt

# Run the backend server
python backend_example.py
```

The backend will start on `http://localhost:5000` with these endpoints:
- `GET /bbox` - Get parcels by bounding box
- `POST /llm_query` - Process natural language queries
- `GET /parcels` - Get parcels by filters
- `GET /health` - Health check

### 2. Frontend Setup

In a new terminal, start the React frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` (or similar Vite port).

## 🔧 API Integration Features

### PART 1: Bounding Box Loading
- **Trigger**: Map movement (`moveend` event) and initial load
- **API**: `GET /bbox?north={N}&south={S}&east={E}&west={W}`
- **Behavior**: Automatically loads parcels visible in the current map view
- **Error Handling**: Shows "⚠️ Failed to load parcels in view" on failure

### PART 2: LLM Search Integration
- **Trigger**: User submits search query
- **API**: `POST /llm_query` with `{"prompt": "user query"}`
- **Response**: Structured filters like:
  ```json
  {
    "zoning": "RH-2",
    "neighborhood": "Ingleside", 
    "flood_risk": "High"
  }
  ```
- **Error Handling**: Shows "⚠️ Could not interpret your query" on failure

### PART 3: Filtered Parcel Query
- **Trigger**: After successful LLM query
- **API**: `GET /parcels?zoning=...&neighborhood=...&flood_risk=...`
- **Behavior**: Displays matching parcels on the map
- **Error Handling**: Shows "⚠️ No parcels matched your search" on failure

## 🎯 Usage Examples

### Natural Language Search
Try these search queries in the frontend:

1. **"Show me RH-2 zoning in Ingleside"**
   - Returns: `{"zoning": "RH-2", "neighborhood": "Ingleside"}`

2. **"Commercial properties with high flood risk"**
   - Returns: `{"zoning": "C-2", "flood_risk": "High"}`

3. **"Multi-unit residential in Mission"**
   - Returns: `{"zoning": "RM-1", "neighborhood": "Mission"}`

### Map Navigation
- Pan and zoom the map to automatically load parcels in the visible area
- Use the "Clear Search" button to return to bounds-based loading

## 🏗️ Architecture

### Frontend Components
- `ParcelMap.jsx` - Main map component with API integration
- `MapEventHandler` - Handles map events and API calls
- Async/await pattern for all API calls
- Proper error handling and loading states

### Backend Structure
- Flask server with CORS enabled
- Mock data for demonstration
- Structured API responses
- Error handling for all endpoints

## 🔄 State Management

The frontend manages several states:
- `parcelData` - Current GeoJSON data to display
- `loading` - Loading indicator for parcel data
- `searchLoading` - Loading indicator for search
- `error` - Error messages for parcel loading
- `searchError` - Error messages for search
- `currentFilters` - Active search filters
- `searchQuery` - Current search input

## 🎨 UI Features

- **Search Bar**: Natural language input with LLM processing
- **Error Messages**: Contextual error displays
- **Loading Indicators**: Visual feedback during API calls
- **Clear Search**: Button to reset to bounds-based loading
- **Debug Info**: Shows current state and active filters
- **Legend**: Zoning color coding
- **Responsive Design**: Works on mobile and desktop

## 🧪 Testing the Integration

1. **Start both servers** (backend on port 5000, frontend on port 5173)
2. **Test bounding box loading**: Pan/zoom the map
3. **Test LLM search**: Try the example queries above
4. **Test error handling**: Stop the backend and try searching
5. **Test clear functionality**: Use "Clear Search" button

## 🔧 Configuration

### Backend URL
Update the API base URL in `frontend/src/components/ParcelMap.jsx`:
```javascript
const API_BASE = 'http://localhost:5000'; // Change as needed
```

### CORS
The backend includes CORS support for frontend integration. If you need to modify CORS settings, update the Flask app configuration.

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the backend is running and CORS is enabled
2. **API Connection**: Check that the frontend is pointing to the correct backend URL
3. **No Parcels Loading**: Verify the backend is returning valid GeoJSON
4. **Search Not Working**: Check browser console for API errors

### Debug Mode
The frontend includes debug information that shows:
- Number of parcels loaded
- Active filters
- API response status

## 🔮 Future Enhancements

- Real LLM integration (OpenAI, Claude, etc.)
- Database integration for actual parcel data
- Advanced filtering options
- Parcel selection and highlighting
- Export functionality
- User authentication
- Caching for better performance

## 📝 API Documentation

### GET /bbox
Query parameters:
- `north` (float): Northern boundary
- `south` (float): Southern boundary  
- `east` (float): Eastern boundary
- `west` (float): Western boundary

Response: GeoJSON FeatureCollection

### POST /llm_query
Request body:
```json
{
  "prompt": "user query string"
}
```

Response:
```json
{
  "zoning": "RH-2",
  "neighborhood": "Ingleside",
  "flood_risk": "High"
}
```

### GET /parcels
Query parameters:
- `zoning` (string, optional): Zoning code
- `neighborhood` (string, optional): Neighborhood name
- `flood_risk` (string, optional): Flood risk level

Response: GeoJSON FeatureCollection 