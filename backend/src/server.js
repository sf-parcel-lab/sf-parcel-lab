require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('SF Parcel Backend API');
});

const { MongoClient } = require('mongodb');

// Route API pour exposer les parcelles
app.get('/api/parcels', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    // Utilise la variable d'environnement MONGODB_DB pour la base (ex: 'sf_parcels')
    const dbName = process.env.MONGODB_DB || 'test';
    const db = client.db(dbName);
    const parcels = await db.collection('parcels_merged').find({}).toArray();
    console.log('Nombre de parcelles retournées :', parcels.length, 'depuis la base', dbName);

    // Convertir les parcelles en format GeoJSON FeatureCollection
    const geojsonFeatures = parcels.map(parcel => ({
      type: 'Feature',
      geometry: parcel.shape || parcel.geometry || null,
      properties: {
        // Inclure toutes les propriétés sauf les champs géométriques
        ...Object.fromEntries(
          Object.entries(parcel).filter(([key]) => 
            !['shape', 'geometry', 'the_geom'].includes(key)
          )
        )
      }
    }));

    const geojsonResponse = {
      type: 'FeatureCollection',
      features: geojsonFeatures
    };

    res.json(geojsonResponse);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
