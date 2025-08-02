import json
from collections import Counter

def analyze_parcels():
    """Analyze the merged_parcels.geojson file to count unique parcel IDs."""
    
    try:
        # Load the GeoJSON file
        with open('merged_parcels.geojson', 'r') as f:
            data = json.load(f)
        
        print(f"✅ Successfully loaded merged_parcels.geojson")
        print(f"📊 Total features: {len(data['features'])}")
        
        # Extract parcel IDs
        parcel_ids = []
        zoning_types = []
        land_use_types = []
        
        for feature in data['features']:
            properties = feature['properties']
            
            # Get parcel ID
            parcel_id = properties.get('parcel_id')
            if parcel_id:
                parcel_ids.append(parcel_id)
            
            # Get zoning
            zoning = properties.get('zoning')
            if zoning:
                zoning_types.append(zoning)
            
            # Get land use
            land_use = properties.get('land_use')
            if land_use:
                land_use_types.append(land_use)
        
        # Count unique values
        unique_parcel_ids = set(parcel_ids)
        unique_zoning = set(zoning_types)
        unique_land_use = set(land_use_types)
        
        print(f"\n📈 Unique Parcel IDs: {len(unique_parcel_ids)}")
        print(f"🏗️  Unique Zoning Types: {len(unique_zoning)}")
        print(f"🏘️  Unique Land Use Types: {len(unique_land_use)}")
        
        # Show some sample parcel IDs
        print(f"\n🔍 Sample Parcel IDs (first 10):")
        for i, pid in enumerate(list(unique_parcel_ids)[:10]):
            print(f"  {i+1}. {pid}")
        
        # Show zoning distribution
        zoning_counter = Counter(zoning_types)
        print(f"\n🎨 Zoning Distribution:")
        for zoning, count in zoning_counter.most_common():
            print(f"  {zoning}: {count} parcels")
        
        # Show land use distribution
        land_use_counter = Counter(land_use_types)
        print(f"\n🏠 Land Use Distribution:")
        for land_use, count in land_use_counter.most_common():
            print(f"  {land_use}: {count} parcels")
        
        # Check for missing data
        missing_parcel_ids = len(data['features']) - len(parcel_ids)
        missing_zoning = len(data['features']) - len(zoning_types)
        missing_land_use = len(data['features']) - len(land_use_types)
        
        print(f"\n⚠️  Missing Data:")
        print(f"  Parcel IDs missing: {missing_parcel_ids}")
        print(f"  Zoning missing: {missing_zoning}")
        print(f"  Land Use missing: {missing_land_use}")
        
        return len(unique_parcel_ids)
        
    except FileNotFoundError:
        print("❌ Error: merged_parcels.geojson file not found!")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in merged_parcels.geojson: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    analyze_parcels() 