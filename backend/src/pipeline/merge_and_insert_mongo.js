require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');

async function fetchAllData(url, batchSize = 1000, maxTotal = 100000) {
  let results = [];
  let offset = 0;
  while (true) {
    const batchUrl = `${url}?$limit=${batchSize}&$offset=${offset}`;
    const response = await axios.get(batchUrl);
    const data = response.data;
    results = results.concat(data);
    if (!data.length || data.length < batchSize || results.length >= maxTotal) break;
    offset += batchSize;
  }
  return results;
}

async function fetchZoning() {
  return fetchAllData(process.env.ZONING_DATA_URL);
}

async function fetchLandUse() {
  return fetchAllData(process.env.LAND_USE_DATA_URL);
}

async function fetchParcels() {
  return fetchAllData(process.env.PARCELS_DATA_URL);
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

async function upsertParcelsMergedMongo(merged, db, batchSize = 500) {
  const collection = db.collection('parcels_merged');
  // Vide la collection avant chaque import
  await collection.deleteMany({});
  console.log('Collection parcels_merged vidée.');
  let total = merged.length;
  let inserted = 0;
  for (let i = 0; i < total; i += batchSize) {
    const batch = merged.slice(i, i + batchSize);
    // Diagnostic : log la clé unique du premier doc du batch
    if (i === 0) {
      console.log('Exemple de parcel_id dans ce batch :', batch[0].parcel_id);
      console.log('Exemple de mapblklot dans ce batch :', batch[0].mapblklot);
      const uniques = new Set(batch.map(doc => doc.mapblklot));
      console.log('Nombre de mapblklot uniques dans ce batch :', uniques.size);
    }
    const ops = batch.map(doc => ({
      updateOne: {
        filter: { mapblklot: doc.mapblklot },
        update: { $set: { ...doc, geometry: doc.geometry || null, updated_at: new Date() } },
        upsert: true
      }
    }));
    await collection.bulkWrite(ops, { ordered: false });
    inserted += batch.length;
    console.log(`Upserted batch ${Math.ceil(inserted / batchSize)}/${Math.ceil(total / batchSize)} (${inserted}/${total})`);
  }
  console.log(`All ${total} documents upserted in batches of ${batchSize}.`);
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
    if (parcels.length === 0) {
      console.error('No parcels data fetched! Aborting.');
      return;
    }
    console.log('Merging datasets...');
    const merged = mergeDatasets(parcels, zoning, landUse);
    console.log(`Merged dataset: ${merged.length} parcels.`);
    if (merged.length === 0) {
      console.error('No merged data to insert!');
      return;
    }
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
