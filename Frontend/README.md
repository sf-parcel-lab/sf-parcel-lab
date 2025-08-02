# AI + Map Explorer: San Francisco Zoning Assistant

A conversational AI system that helps users find suitable parcels for development in San Francisco through natural language queries and interactive mapping.

## 🏗️ System Architecture

```
[ User ]
   |
   |   (asks) "Where can I build a duplex near Mission Street?"
   ↓
[ Chatbot on website (LLM) ]
   |
   |   → Parses intent → zone = "RM-2", use = "Residential", street = "Mission"
   ↓
[ FastAPI backend ]
   |
   |   → Queries GeoDataFrame or MongoDB
   ↓
[ Map frontend (React + Leaflet) ]
   |
   |   → Highlights matching parcels and shows them in popup/list
```

## 🧭 Step-by-Step Implementation Plan

### ✅ Phase 1: Data Foundation
- [x] **Merged Datasets**: Created `merged_parcels.geojson` with parcels, zoning, and land use data
- [x] **Data Structure**: 1,171 parcels with columns: `parcel_id`, `zoning`, `land_use`, `area_sqft`, `geometry`
- [x] **CRS**: Normalized to EPSG:4326 for web mapping

### ✅ Phase 2: Interactive Map (React + Leaflet)
**Status**: Ready to implement

**Components**:
- Map container with Leaflet/Mapbox
- Filter panel (zone, land use, area, street)
- Parcel highlighting system
- Popup/list for selected parcels

**Features**:
- Load `merged_parcels.geojson`
- Real-time filtering
- Parcel selection and highlighting
- Export filtered results

**Tech Stack**:
```bash
npm create vite@latest map-explorer -- --template react
npm install leaflet react-leaflet
npm install @types/leaflet
```

### ✅ Phase 3: FastAPI Backend
**Status**: Ready to implement

**Endpoints**:
```python
# Core parcel queries
GET /parcels?zone=RM-2&land_use=Residential&min_area=5000&street=Mission
GET /parcel/{id}

# AI query processing
POST /ai-query
{
  "query": "Where can I build a duplex near Mission Street?",
  "filters": {
    "zone": "RM-2",
    "land_use": "Residential", 
    "street": "Mission"
  }
}

# Export functionality
GET /export?query=...&format=geojson
```

**Tech Stack**:
```bash
pip install fastapi uvicorn geopandas pandas
```

### ✅ Phase 4: AI Chatbot (LLM Agent)
**Status**: Ready to implement

**Options**:
1. **LangChain Agent** in FastAPI
2. **OpenAI Function-calling** endpoint
3. **Claude/Gemini** + tool access

**Chatbot Requirements**:
- Context: "You're a planning assistant for SF zoning."
- Tool: `search_parcels(zone, use, area, street)`
- Response logic: returns parcel IDs + summary

**Example Interaction**:
```
User: "Where can I buy a residential lot over 500m² on Mission Street?"

System (behind the scenes):
LLM → zone=RM-*, land_use=Residential, min_area=5381 (500m²), street=Mission
/parcels?land_use=Residential&min_area=5381&street=Mission
Returns 4 parcels → map highlights those

Chatbot replies:
"I found 4 parcels matching your criteria. One is 1,080 m², zoned RM-2 at 123 Mission St."
```

### ✅ Phase 5: Map ↔ Chatbot Communication
**Status**: Ready to implement

**Flow**:
1. User enters query in chatbot panel (map UI)
2. Chatbot POSTs filters → `/ai-query`
3. API returns parcel IDs or GeoJSON features
4. Map updates: highlights + popup summaries

## 🔧 Optional Enhancements

| Feature | Implementation |
|---------|----------------|
| "Refine my search" | Pass chat history to LLM context |
| "Save parcels" | Store selected IDs in localStorage or backend |
| "Explain zoning rules" | LLM fetches descriptions from context |
| Export filtered parcels | `/export?query=...` as GeoJSON or CSV |
| Advanced filtering | Date ranges, price estimates, development potential |
| User accounts | Save search history and favorite parcels |

## 📁 Project Structure

```
hackathonxSF/
├── data/
│   ├── merged_parcels.geojson          # ✅ Created
│   └── zoning_descriptions.json        # 📝 To create
├── backend/
│   ├── main.py                         # FastAPI app
│   ├── models.py                       # Pydantic models
│   ├── database.py                     # GeoDataFrame queries
│   └── ai_agent.py                     # LLM integration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map.jsx                 # Leaflet map
│   │   │   ├── Chatbot.jsx             # AI chat interface
│   │   │   └── Filters.jsx             # Filter panel
│   │   └── services/
│   │       └── api.js                  # API calls
│   └── package.json
├── merge_datasets.py                   # ✅ Created
├── requirements.txt                    # ✅ Created
└── README.md                          # ✅ This file
```

## 🚀 Quick Start

### 1. Data Setup
```bash
# Already completed
python merge_datasets.py
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🎯 Core Features

### Natural Language Queries
- "Find residential lots over 5000 sq ft"
- "Show me RM-2 zoned properties near Mission Street"
- "Where can I build a duplex?"
- "What's the largest commercial lot available?"

### Interactive Mapping
- Real-time parcel filtering
- Highlighted search results
- Detailed parcel information popups
- Export filtered results

### AI-Powered Insights
- Zoning rule explanations
- Development potential analysis
- Market insights and trends
- Permit requirement summaries

## 🔍 Data Schema

### Parcel Data (`merged_parcels.geojson`)
```json
{
  "parcel_id": "0477032",
  "zoning": "RM-2", 
  "land_use": "Residential",
  "area_sqft": 286.99,
  "geometry": "MULTIPOLYGON(...)"
}
```

### Query Filters
```json
{
  "zone": ["RM-2", "RM-3"],
  "land_use": ["Residential", "Commercial"],
  "min_area": 5000,
  "max_area": 50000,
  "street": "Mission",
  "neighborhood": "Mission District"
}
```

## 🛠️ Development Roadmap

### Week 1: Foundation
- [x] Data preparation and merging
- [ ] Basic FastAPI backend
- [ ] Simple React map component

### Week 2: Core Features
- [ ] Parcel filtering and search
- [ ] Map highlighting system
- [ ] Basic chatbot integration

### Week 3: AI Enhancement
- [ ] LLM agent implementation
- [ ] Natural language query parsing
- [ ] Advanced filtering options

### Week 4: Polish & Deploy
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Deployment to production

## 📊 Current Data Status

- **Total Parcels**: 1,171
- **Zoning Coverage**: 806 parcels with zoning data (365 missing)
- **Land Use Coverage**: 84 parcels with land use data (1,087 missing)
- **Area Data**: All parcels have calculated area
- **CRS**: EPSG:4326 (web-ready)

## 🎯 Success Metrics

- **Query Response Time**: < 2 seconds
- **Map Rendering**: < 1 second for 1000+ parcels
- **AI Accuracy**: > 90% intent parsing
- **User Engagement**: Average session > 5 minutes

---

**TL;DR**: Building a map-based data tool + chat-based natural language interface, unified through a shared backend that understands SF zoning, parcels, and filters. 