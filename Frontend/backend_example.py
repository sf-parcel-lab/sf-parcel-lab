from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import random

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Mock data for demonstration
MOCK_PARCELS = [
    {
        "type": "Feature",
        "properties": {
            "parcel_id": "SF001",
            "zoning": "RH-2",
            "land_use": "Residential",
            "area_sqft": 2500,
            "neighborhood": "Ingleside",
            "flood_risk": "Low"
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[-122.4194, 37.7749], [-122.4184, 37.7749], [-122.4184, 37.7739], [-122.4194, 37.7739], [-122.4194, 37.7749]]]
        }
    },
    {
        "type": "Feature",
        "properties": {
            "parcel_id": "SF002",
            "zoning": "C-2",
            "land_use": "Commercial",
            "area_sqft": 5000,
            "neighborhood": "Mission",
            "flood_risk": "Medium"
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[-122.4204, 37.7759], [-122.4194, 37.7759], [-122.4194, 37.7749], [-122.4204, 37.7749], [-122.4204, 37.7759]]]
        }
    },
    {
        "type": "Feature",
        "properties": {
            "parcel_id": "SF003",
            "zoning": "RM-1",
            "land_use": "Residential",
            "area_sqft": 3000,
            "neighborhood": "Ingleside",
            "flood_risk": "High"
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[-122.4214, 37.7769], [-122.4204, 37.7769], [-122.4204, 37.7759], [-122.4214, 37.7759], [-122.4214, 37.7769]]]
        }
    }
]

@app.route('/bbox', methods=['GET'])
def get_parcels_by_bbox():
    """PART 1: Get parcels within bounding box"""
    try:
        north = float(request.args.get('north', 37.8))
        south = float(request.args.get('south', 37.7))
        east = float(request.args.get('east', -122.4))
        west = float(request.args.get('west', -122.5))
        
        # Mock filtering by bounding box
        # In a real implementation, you would query your database
        filtered_parcels = []
        for parcel in MOCK_PARCELS:
            coords = parcel['geometry']['coordinates'][0][0]  # First point of polygon
            lon, lat = coords[0], coords[1]
            
            if west <= lon <= east and south <= lat <= north:
                filtered_parcels.append(parcel)
        
        # Add some random parcels for demonstration
        if not filtered_parcels:
            filtered_parcels = random.sample(MOCK_PARCELS, min(2, len(MOCK_PARCELS)))
        
        return jsonify({
            "type": "FeatureCollection",
            "features": filtered_parcels
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/llm_query', methods=['POST'])
def process_llm_query():
    """PART 2: Process natural language query and return structured filters"""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '').lower()
        
        # Mock LLM processing - in reality, this would call an actual LLM
        filters = {}
        
        # Simple keyword matching for demonstration
        if 'rh-2' in prompt or 'residential house' in prompt:
            filters['zoning'] = 'RH-2'
        elif 'rm-1' in prompt or 'multi-unit' in prompt:
            filters['zoning'] = 'RM-1'
        elif 'c-2' in prompt or 'commercial' in prompt:
            filters['zoning'] = 'C-2'
        
        if 'ingleside' in prompt:
            filters['neighborhood'] = 'Ingleside'
        elif 'mission' in prompt:
            filters['neighborhood'] = 'Mission'
        
        if 'high' in prompt and 'flood' in prompt:
            filters['flood_risk'] = 'High'
        elif 'low' in prompt and 'flood' in prompt:
            filters['flood_risk'] = 'Low'
        elif 'medium' in prompt and 'flood' in prompt:
            filters['flood_risk'] = 'Medium'
        
        # If no filters found, return a default
        if not filters:
            filters = {
                "zoning": "RH-2",
                "neighborhood": "Ingleside",
                "flood_risk": "Low"
            }
        
        return jsonify(filters)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/parcels', methods=['GET'])
def get_parcels_by_filters():
    """PART 3: Get parcels matching specific filters"""
    try:
        zoning = request.args.get('zoning')
        neighborhood = request.args.get('neighborhood')
        flood_risk = request.args.get('flood_risk')
        
        filtered_parcels = []
        
        for parcel in MOCK_PARCELS:
            props = parcel['properties']
            matches = True
            
            if zoning and props.get('zoning') != zoning:
                matches = False
            if neighborhood and props.get('neighborhood') != neighborhood:
                matches = False
            if flood_risk and props.get('flood_risk') != flood_risk:
                matches = False
            
            if matches:
                filtered_parcels.append(parcel)
        
        return jsonify({
            "type": "FeatureCollection",
            "features": filtered_parcels
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Backend API is running"})

if __name__ == '__main__':
    print("Starting backend server...")
    print("Available endpoints:")
    print("  GET  /bbox?north=X&south=Y&east=Z&west=W")
    print("  POST /llm_query")
    print("  GET  /parcels?zoning=X&neighborhood=Y&flood_risk=Z")
    print("  GET  /health")
    print("\nFrontend should be configured to connect to: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000) 