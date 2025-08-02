require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('parcels_merged');
    const count = await collection.countDocuments();
    console.log(`Nombre de parcelles fusionnées dans MongoDB: ${count}`);
    if (count > 0) {
      const examples = await collection.find({}).limit(5).toArray();
      console.log('Exemples de documents:');
      examples.forEach((doc, i) => {
        console.log(`--- Parcelle #${i + 1} ---`);
        console.log(JSON.stringify(doc, null, 2));
      });
      console.log('Data looks OK');
    } else {
      console.warn('La collection est vide');
    }
  } catch (err) {
    console.error('MongoDB data check failed:', err);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  checkData();
}

module.exports = checkData;
