require('dotenv').config();
const axios = require('axios');
const sequelize = require('../db');
const { QueryTypes } = require('sequelize');

// Example: fetch zoning data (GeoJSON-like)
async function fetchZoning() {
  const url = process.env.ZONING_DATA_URL;
  const response = await axios.get(url);
  return response.data;
}

// Merge datasets by parcel_id (simple version, extend as needed)
function mergeDatasets(zoningArr, ...otherDatasets) {
  // Index other datasets by parcel_id for fast lookup
  const otherIndexes = otherDatasets.map(ds => {
    const idx = {};
    ds.forEach(f => {
      if (f.parcel_id) idx[f.parcel_id] = f;
    });
    return idx;
  });

  // Merge all info into one object per parcel
  return zoningArr.map(z => {
    const merged = { ...z };
    otherIndexes.forEach(idx => {
      if (z.parcel_id && idx[z.parcel_id]) {
        Object.assign(merged, idx[z.parcel_id]);
      }
    });
    return merged;
  });
}

// Insert merged features into parcels_merged
async function upsertParcelsMerged(features) {
  for (const feat of features) {
    // Example: geometry as WKT or GeoJSON (adapt as needed)
    const parcel_id = feat.parcel_id || null;
    const properties = { ...feat };
    delete properties.geometry;
    let geom = null;
    if (feat.geometry && feat.geometry.type && feat.geometry.coordinates) {
      // Convert GeoJSON to WKT for PostGIS
      geom = JSON.stringify(feat.geometry);
    }
    await sequelize.query(
      `INSERT INTO parcels_merged (parcel_id, properties, geometry, updated_at)
       VALUES (:parcel_id, :properties, ST_SetSRID(ST_GeomFromGeoJSON(:geom),4326), now())
       ON CONFLICT (parcel_id) DO UPDATE SET properties = EXCLUDED.properties, geometry = EXCLUDED.geometry, updated_at = now();`,
      {
        replacements: { parcel_id, properties, geom },
        type: QueryTypes.INSERT,
      }
    );
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');
    const zoning = await fetchZoning();
    // TODO: fetch other datasets
    // const landUse = await fetchLandUse();
    // const permits = await fetchPermits();
    // ...
    const merged = mergeDatasets(zoning /*, landUse, permits */);
    await upsertParcelsMerged(merged);
    console.log('Merge & insert done!');
  } catch (err) {
    console.error('Pipeline error:', err);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}
