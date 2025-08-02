import geopandas as gpd

# Load the merged dataset
gdf = gpd.read_file('merged_parcels.geojson')

print(f"✅ Successfully loaded merged dataset")
print(f"   Total features: {len(gdf)}")
print(f"   Columns: {list(gdf.columns)}")
print(f"   CRS: {gdf.crs}")

# Show first few rows
print(f"\nFirst 3 rows:")
print(gdf.head(3))

# Check for any missing values
print(f"\nMissing values per column:")
for col in gdf.columns:
    missing_count = gdf[col].isna().sum()
    if missing_count > 0:
        print(f"   {col}: {missing_count} missing values")
    else:
        print(f"   {col}: No missing values") 