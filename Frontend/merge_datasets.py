import requests
import geopandas as gpd
from io import BytesIO
import pandas as pd

def download_geojson(url):
    """Download GeoJSON data from URL and return response."""
    print(f"Downloading {url}...")
    response = requests.get(url)
    response.raise_for_status()
    return response

def load_geodataframe(response):
    """Load GeoJSON data from response into GeoDataFrame."""
    return gpd.read_file(BytesIO(response.content))

def examine_dataset_headers():
    """Examine the headers/columns of each dataset."""
    
    # URLs for the datasets
    urls = {
        'parcels': 'https://data.sfgov.org/resource/acdm-wktn.geojson',
        'zoning': 'https://data.sfgov.org/resource/3i4a-hu95.geojson',
        'land_use': 'https://data.sfgov.org/resource/fdfd-xptc.geojson'
    }
    
    print("🔍 Examining dataset headers...")
    print("=" * 60)
    
    datasets = {}
    
    for name, url in urls.items():
        try:
            print(f"\n📊 {name.upper()} DATASET:")
            print("-" * 40)
            
            # Download and load dataset
            response = download_geojson(url)
            gdf = load_geodataframe(response)
            
            # Store for later use
            datasets[name] = gdf
            
            # Display basic info
            print(f"✅ Loaded {name} dataset with {len(gdf)} features")
            print(f"📋 CRS: {gdf.crs}")
            print(f"📋 Total columns: {len(gdf.columns)}")
            
            # Display all columns
            print(f"\n📋 All columns:")
            for i, col in enumerate(gdf.columns, 1):
                print(f"  {i:2d}. {col}")
            
            # Show sample data for key columns
            print(f"\n📋 Sample data (first 3 rows):")
            print(gdf.head(3))
            
            # Check for potential ID columns
            id_columns = [col for col in gdf.columns if 'id' in col.lower() or 'lot' in col.lower() or 'block' in col.lower()]
            if id_columns:
                print(f"\n🔑 Potential ID columns: {id_columns}")
            
            # Check for zoning-related columns
            zoning_columns = [col for col in gdf.columns if 'zoning' in col.lower() or 'zone' in col.lower()]
            if zoning_columns:
                print(f"\n🏗️  Zoning-related columns: {zoning_columns}")
            
            # Check for land use columns
            land_use_columns = [col for col in gdf.columns if 'land' in col.lower() or 'use' in col.lower()]
            if land_use_columns:
                print(f"\n🏘️  Land use columns: {land_use_columns}")
            
            # Check for area columns
            area_columns = [col for col in gdf.columns if 'area' in col.lower() or 'size' in col.lower()]
            if area_columns:
                print(f"\n📏 Area-related columns: {area_columns}")
            
        except Exception as e:
            print(f"❌ Error loading {name} dataset: {e}")
            continue
    
    return datasets

# --- NEW MERGE LOGIC WITH LEFT JOINS TO PRESERVE ALL PARCELS ---
def new_merge_with_left_joins():
    """
    NEW MERGE LOGIC WITH PROPER LEFT JOINS TO PRESERVE ALL PARCELS:
    1. ALL PARCELS ARE PRESERVED - even if they don't have matching zoning/land_use
    2. Regular join first: parcels + land_use (on blklot = mapblklot)
    3. Spatial join second: result + zoning (using geometry intersection)
    4. Use how='left' for both joins to preserve all parcels
    """
    print("\n🚦 Starting new merge with left joins...")
    print("=" * 60)
    urls = {
        'parcels': 'https://data.sfgov.org/resource/acdm-wktn.geojson?$limit=5000',
        'zoning': 'https://data.sfgov.org/resource/3i4a-hu95.geojson?$limit=5000',
        'land_use': 'https://data.sfgov.org/resource/fdfd-xptc.geojson?$limit=5000'
    }
    print("\n📥 Loading datasets...")
    datasets = {}
    for name, url in urls.items():
        try:
            response = download_geojson(url)
            gdf = load_geodataframe(response)
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            datasets[name] = gdf
            print(f"✅ Loaded {name}: {len(gdf)} features")
        except Exception as e:
            print(f"❌ Error loading {name}: {e}")
            return None
    print("\n🏠 Preparing parcels dataset...")
    parcels = datasets['parcels'].copy()
    if 'blklot' in parcels.columns:
        parcels = parcels.rename(columns={'blklot': 'parcel_id'})
        print("   ✅ Renamed 'blklot' to 'parcel_id'")
    # Handle area calculation
    if 'shape_area' in parcels.columns:
        parcels = parcels.rename(columns={'shape_area': 'area_sqft'})
        print("   ✅ Renamed 'shape_area' to 'area_sqft'")
    else:
        print("   📏 Calculating area from geometry...")
        # For large datasets, use a more efficient approach
        if len(parcels) > 10000:
            print("   ⚡ Large dataset detected - using approximate area calculation...")
            # Use a simple approximation for large datasets to avoid slow reprojection
            parcels['area_sqft'] = parcels.geometry.area * 111319.9 * 111319.9 * 0.3048 * 0.3048  # Approximate conversion
        else:
            # Convert to projected CRS for accurate area calculation (only for smaller datasets)
            parcels_projected = parcels.to_crs('EPSG:3857')  # Web Mercator
            parcels['area_sqft'] = parcels_projected.geometry.area
        print("   ✅ Calculated area_sqft from geometry")
    print(f"   📊 Parcels prepared: {len(parcels)} features")
    print("\n🏘️ Preparing land_use dataset...")
    land_use = datasets['land_use'].copy()
    land_use_col = None
    for col in land_use.columns:
        if 'land' in col.lower() and 'use' in col.lower():
            land_use_col = col
            break
    if land_use_col:
        land_use = land_use.rename(columns={land_use_col: 'land_use'})
        print(f"   ✅ Renamed '{land_use_col}' to 'land_use'")
    else:
        non_geom_cols = [col for col in land_use.columns if col != 'geometry']
        if non_geom_cols:
            land_use_col = non_geom_cols[0]
            land_use = land_use.rename(columns={land_use_col: 'land_use'})
            print(f"   ⚠️  Using '{land_use_col}' as 'land_use' (fallback)")
    land_use_cols = ['land_use', 'mapblklot', 'geometry']
    available_land_use_cols = [col for col in land_use_cols if col in land_use.columns]
    land_use = land_use[available_land_use_cols]
    print(f"   🏘️ Land use prepared: {len(land_use)} features")
    print("\n🏗️ Preparing zoning dataset...")
    zoning = datasets['zoning'].copy()
    zoning_col = None
    for col in zoning.columns:
        if 'zoning' in col.lower():
            zoning_col = col
            break
    if zoning_col:
        zoning = zoning.rename(columns={zoning_col: 'zoning'})
        print(f"   ✅ Renamed '{zoning_col}' to 'zoning'")
    else:
        non_geom_cols = [col for col in zoning.columns if col != 'geometry']
        if non_geom_cols:
            zoning_col = non_geom_cols[0]
            zoning = zoning.rename(columns={zoning_col: 'zoning'})
            print(f"   ⚠️  Using '{zoning_col}' as 'zoning' (fallback)")
    zoning_cols = ['zoning', 'geometry']
    available_zoning_cols = [col for col in zoning_cols if col in zoning.columns]
    zoning = zoning[available_zoning_cols]
    print(f"   🏗️ Zoning prepared: {len(zoning)} features")
    print("\n🔗 Performing regular join: parcels + land_use...")
    print("   Using LEFT JOIN to preserve ALL parcels")
    if 'parcel_id' in parcels.columns and 'mapblklot' in land_use.columns:
        merged = parcels.merge(
            land_use, 
            left_on='parcel_id', 
            right_on='mapblklot', 
            how='left',
            suffixes=('', '_land_use')
        )
        if 'mapblklot' in merged.columns:
            merged = merged.drop(columns=['mapblklot'])
        print(f"   ✅ Regular join complete: {len(merged)} features (preserved all parcels)")
        parcels_with_land_use = merged['land_use'].notna().sum()
        print(f"   🏘️ Parcels with land_use data: {parcels_with_land_use}/{len(merged)} ({parcels_with_land_use/len(merged)*100:.1f}%)")
    else:
        print("   ⚠️  Missing join columns, skipping land_use join")
        merged = parcels.copy()
    print("\n🗺️ Performing spatial join: result + zoning...")
    print("   Using LEFT JOIN to preserve ALL parcels")
    if 'zoning' in zoning.columns:
        # Spatial join with left join
        final = gpd.sjoin(
            merged, 
            zoning, 
            how='left',  # LEFT JOIN - preserves all parcels
            predicate='intersects'
        )
        # Reset index to avoid duplicate label issues
        final = final.reset_index(drop=True)
        columns_to_drop = ['index_right']
        for col in columns_to_drop:
            if col in final.columns:
                final = final.drop(columns=[col])
        print(f"   ✅ Spatial join complete: {len(final)} features (preserved all parcels)")
        # Count unique parcels with zoning - avoid pandas indexing issues
        unique_parcels = final['parcel_id'].nunique() if 'parcel_id' in final.columns else len(final)
        # Use a completely different approach to avoid indexing issues
        if 'zoning' in final.columns:
            # Convert to regular pandas DataFrame to avoid GeoDataFrame indexing issues
            temp_df = final[['parcel_id', 'zoning']].copy()
            parcels_with_zoning = temp_df[temp_df['zoning'].notna()]['parcel_id'].nunique()
        else:
            parcels_with_zoning = 0
        print(f"   📊 Parcels with zoning data: {parcels_with_zoning}/{unique_parcels} ({(parcels_with_zoning/unique_parcels*100 if unique_parcels else 0):.1f}%)")
    else:
        print("   ⚠️  Missing zoning column, skipping zoning join")
        final = merged.copy()
    print("\n🧹 Cleaning up final dataset...")
    duplicate_cols = final.columns[final.columns.duplicated()].tolist()
    if duplicate_cols:
        print(f"   🗑️  Removing duplicate columns: {duplicate_cols}")
        final = final.loc[:, ~final.columns.duplicated()]
    required_columns = ['parcel_id', 'zoning', 'land_use', 'area_sqft', 'geometry']
    available_columns = [col for col in required_columns if col in final.columns]
    if len(available_columns) < len(required_columns):
        missing = set(required_columns) - set(available_columns)
        print(f"   ⚠️  Missing columns: {missing}")
    final_dataset = final[available_columns]
    if 'zoning' in final_dataset.columns:
        final_dataset['zoning'] = final_dataset['zoning'].fillna('Unknown')
    if 'land_use' in final_dataset.columns:
        final_dataset['land_use'] = final_dataset['land_use'].fillna('Unknown')
    print(f"   ✅ Final dataset: {len(final_dataset)} features")
    print(f"   📋 Final columns: {list(final_dataset.columns)}")
    output_file = 'merged_parcels.geojson'
    final_dataset.to_file(output_file, driver='GeoJSON')
    print(f"\n✅ Successfully saved to {output_file}")
    print(f"📊 Final dataset contains {len(final_dataset)} parcels")
    print(f"\n📈 SUMMARY:")
    print(f"   • Total parcels: {len(final_dataset)}")
    if 'zoning' in final_dataset.columns:
        zoning_counts = final_dataset['zoning'].value_counts()
        print(f"   • Zoning types: {len(zoning_counts)}")
        print(f"   • Top zoning: {zoning_counts.head(3).to_dict()}")
    if 'land_use' in final_dataset.columns:
        land_use_counts = final_dataset['land_use'].value_counts()
        print(f"   • Land use types: {len(land_use_counts)}")
        print(f"   • Top land use: {land_use_counts.head(3).to_dict()}")
    print("\n⚠️ NOTE: Only 1000 parcels are downloaded because the Socrata API (data.sfgov.org) defaults to a limit of 1000 records per request. To get more, you must use the $limit parameter in the URL, e.g. '?$limit=50000'.")
    return final_dataset
# --- END NEW MERGE LOGIC ---

def main():
    """Main function to examine dataset headers."""
    print("🚀 Starting dataset header examination...")
    print("=" * 60)
    
    # Examine headers of all datasets
    datasets = examine_dataset_headers()
    
    print("\n" + "=" * 60)
    print("✅ Dataset header examination complete!")
    print("\n📝 Next steps:")
    print("1. Review the column names above")
    print("2. Identify the correct columns for merging")
    print("3. Plan the field mapping strategy")
    print("4. Rebuild the merge logic")

if __name__ == "__main__":
    main() 