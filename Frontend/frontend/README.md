# SF Parcel Explorer Frontend

A React application that displays San Francisco parcels on an interactive map using Leaflet.

## Features

- **Interactive Map**: Full-screen map centered on San Francisco
- **Parcel Visualization**: All 1,171 parcels displayed with zoning-based coloring
- **Click Popups**: Detailed parcel information on click
- **Search Bar**: Placeholder for future AI integration
- **Mobile Responsive**: Optimized for mobile devices
- **Zoning Legend**: Color-coded legend showing zoning categories

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

## Project Structure

```
frontend/
├── public/
│   └── merged_parcels.geojson    # Parcel data
├── src/
│   ├── components/
│   │   ├── ParcelMap.jsx         # Main map component
│   │   └── ParcelMap.css         # Map styles
│   ├── App.jsx                   # Main app component
│   ├── App.css                   # App styles
│   └── main.jsx                  # Entry point
├── package.json                  # Dependencies
└── vite.config.js               # Vite configuration
```

## Component Features

### ParcelMap Component

- **Map Container**: Full-screen Leaflet map
- **GeoJSON Layer**: Renders all parcels with styling
- **Zoning Colors**: 
  - RM-* (Residential Multi-Unit): Blue
  - RH-* (Residential House): Green
  - C-* (Commercial): Red
  - M-* (Mixed Use): Orange
  - No data: Gray
- **Popup Information**: Parcel ID, zoning, land use, area
- **Search Bar**: Top-center search input (placeholder)
- **Legend**: Bottom-right zoning color guide

### Styling

- **Mobile Responsive**: Adapts to different screen sizes
- **Modern UI**: Clean, professional design
- **Loading States**: Spinner and error handling
- **Smooth Animations**: Hover effects and transitions

## Data Format

The component expects a GeoJSON file with the following structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "parcel_id": "0477032",
        "zoning": "RM-2",
        "land_use": "Residential",
        "area_sqft": 286.99
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [...]
      }
    }
  ]
}
```

## Future Enhancements

- [ ] AI-powered search integration
- [ ] Filtering by zoning/land use
- [ ] Parcel selection and highlighting
- [ ] Export functionality
- [ ] Advanced analytics
- [ ] User accounts and saved searches

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

1. **New Components**: Create in `src/components/`
2. **Styling**: Use CSS modules or styled-components
3. **State Management**: Consider Redux for complex state
4. **API Integration**: Add services in `src/services/`

## Troubleshooting

### Common Issues

1. **Map not loading**: Check if `merged_parcels.geojson` is in `/public/`
2. **Styling issues**: Ensure Leaflet CSS is imported
3. **Mobile display**: Test on actual devices, not just browser dev tools

### Performance

- GeoJSON file is ~770KB with 1,171 features
- Consider clustering for better performance with larger datasets
- Implement lazy loading for very large datasets

## Contributing

1. Follow React best practices
2. Use functional components with hooks
3. Maintain mobile-first responsive design
4. Add proper error handling
5. Include loading states for async operations 