require('dotenv').config();
const axios = require('axios');
const { MongoClient } = require('mongodb');
const turf = require('@turf/turf');

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


// Fetch Special Use Districts (SUDs)
async function fetchSpecialUseDistricts() {
  return fetchAllData(process.env.SPECIAL_USE_DISTRICTS_DATA_URL);
}

async function fetchLandUse() {
  return fetchAllData(process.env.LAND_USE_DATA_URL);
}

async function fetchParcels() {
  return fetchAllData(process.env.PARCELS_DATA_URL);
}

// Fetch Building Permits
async function fetchBuildingPermits() {
  return fetchAllData(process.env.BUILDING_PERMITS_DATA_URL);
}

// Fetch Air Pollutant Exposure Zone (APEZ)
async function fetchAPEZ() {
  return fetchAllData(process.env.APEZ_DATA_URL);
}

// Fetch Landslide Susceptibility Hazard Zones
async function fetchLandslideHazard() {
  return fetchAllData(process.env.LANDSLIDE_HAZARD_DATA_URL);
}

// Fetch 100-Year Storm Flood Risk Zone
async function fetchFloodRiskZone() {
  return fetchAllData(process.env.FLOOD_RISK_ZONE_DATA_URL);
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

    console.log('Fetching special use districts (SUDs)...');
    const suds = await fetchSpecialUseDistricts();
    console.log(`Fetched ${suds.length} SUDs records.`);
    // TODO: merge zoningDistricts and SUDs into parcels
    // Fetch building permits
    console.log('Fetching building permits...');
    const buildingPermits = await fetchBuildingPermits();
    console.log(`Fetched ${buildingPermits.length} building permits records.`);
    // TODO: merge permits into parcels
    // Fetch APEZ
    console.log('Fetching Air Pollutant Exposure Zones (APEZ)...');
    const apez = await fetchAPEZ();
    console.log(`Fetched ${apez.length} APEZ records.`);
    // Fetch Landslide Hazard
    console.log('Fetching Landslide Susceptibility Hazard Zones...');
    const landslideHazard = await fetchLandslideHazard();
    console.log(`Fetched ${landslideHazard.length} landslide hazard records.`);
    if (parcels.length === 0) {
      console.error('No parcels data fetched! Aborting.');
      return;
    }
    console.log('Merging datasets...');
    // Préparation des polygones overlays
    const sudPolygons = (suds || []).map(sud => ({
      name: (sud.sud_name || '').trim(),
      geometry: sud.shape || sud.geometry
    })).filter(s => s.geometry);
    const priorityEquityPolygons = sudPolygons.filter(s => s.name === 'Priority Equity Geographies SUD');
    const otherSUDPolygons = sudPolygons.filter(s => s.name && s.name !== 'Priority Equity Geographies SUD');
    const apezPolygons = (apez || []).map(a => a.shape || a.geometry).filter(Boolean);
    const landslidePolygons = (landslideHazard || []).map(l => l.shape || l.geometry).filter(Boolean);

    // Fetch Flood Risk Zone
    console.log('Fetching Flood Risk Zone (100-Year Storm)...');
    const floodRiskZone = await fetchFloodRiskZone();
    console.log(`Fetched ${floodRiskZone.length} flood risk zone records.`);
    const floodPolygons = (floodRiskZone || []).map(f => f.shape || f.geometry).filter(Boolean);

    // Croisement géométrique pour chaque parcelle
    const merged = mergeDatasets(parcels, zoning, landUse).map(parcel => {
      const parcelGeom = parcel.shape || parcel.geometry;
      let overlays = [];
      let priorityEquity = false;
      let inAPEZ = false;
      let inLandslide = false;
      let inFlood = false;
      if (parcelGeom) {
        // Priority Equity
        priorityEquity = priorityEquityPolygons.some(poly => {
          try { return turf.booleanIntersects(parcelGeom, poly.geometry); } catch { return false; }
        });
        // SUD overlays
        overlays = otherSUDPolygons.filter(poly => {
          try { return turf.booleanIntersects(parcelGeom, poly.geometry); } catch { return false; }
        }).map(poly => poly.name);
        // APEZ
        inAPEZ = apezPolygons.some(poly => {
          try { return turf.booleanIntersects(parcelGeom, poly); } catch { return false; }
        });
        // Landslide
        inLandslide = landslidePolygons.some(poly => {
          try { return turf.booleanIntersects(parcelGeom, poly); } catch { return false; }
        });
        // Flood Risk
        inFlood = floodPolygons.some(poly => {
          try { return turf.booleanIntersects(parcelGeom, poly); } catch { return false; }
        });
      }
      return {
        ...parcel,
        priority_equity_geography: priorityEquity,
        overlays,
        apez: inAPEZ,
        landslide_hazard: inLandslide,
        flood_risk_zone: inFlood
      };
    });
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
