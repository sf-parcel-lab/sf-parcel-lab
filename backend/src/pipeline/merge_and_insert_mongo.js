require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');

async function fetchZoning() {
  const url = process.env.ZONING_DATA_URL;
  const response = await axios.get(url);
  return response.data;
}

async function fetchLandUse() {
  const url = process.env.LAND_USE_DATA_URL;
  const response = await axios.get(url);
  return response.data;
}

async function fetchParcels() {
  const url = process.env.PARCELS_DATA_URL;
  const response = await axios.get(url);
  return response.data;
}

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

async function upsertParcelsMergedMongo(features, db) {
  const collection = db.collection('parcels_merged');
  for (const feat of features) {
    // MongoDB expects geometry in GeoJSON format, and can index it nativement
    await collection.updateOne(
      { parcel_id: feat.parcel_id },
      {
        $set: {
          ...feat,
          geometry: feat.geometry || null,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  }
}

async function main() {
  console.log('MONGODB_URI:', process.env.MONGODB_URI);
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db(process.env.MONGODB_DB);
    console.log('Fetching zoning data...');
    const zoning = await fetchZoning();
    console.log(`Fetched ${zoning.length} zoning records.`);
    console.log('Fetching land use data...');
    const landUse = await fetchLandUse();
    console.log(`Fetched ${landUse.length} land use records.`);
    console.log('Fetching parcels data...');
    const parcels = await fetchParcels();
    console.log(`Fetched ${parcels.length} parcels records.`);
    // TODO: fetch other datasets (permits, etc.)
    console.log('Merging datasets...');
    const merged = mergeDatasets(parcels, zoning, landUse);
    console.log(`Merged dataset: ${merged.length} parcels.`);
    console.log('Upserting into MongoDB...');
    await upsertParcelsMergedMongo(merged, db);
    console.log('Merge & insert done in MongoDB!');
  } catch (err) {
    console.error('Pipeline error:', err);
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

if (require.main === module) {
  main();
}
