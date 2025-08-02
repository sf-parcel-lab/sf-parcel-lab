require('dotenv').config();
const axios = require('axios');
const sequelize = require('../db');

async function fetchZoningData() {
  const url = process.env.ZONING_DATA_URL;
  const response = await axios.get(url);
  return response.data;
}

// TODO: cleaning, merging, inserting logic

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');
    const zoning = await fetchZoningData();
    console.log(`Fetched ${zoning.length} zoning records.`);
    // TODO: clean, merge, insert into DB
  } catch (err) {
    console.error('Pipeline error:', err);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}
