require('dotenv').config();
const sequelize = require('./db');

async function checkData() {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');

    const [countResults] = await sequelize.query(
      'SELECT COUNT(*) AS count FROM parcels_merged;'
    );
    const count = parseInt(countResults[0].count, 10);
    console.log(`parcels_merged has ${count} rows.`);

    if (count > 0) {
      const [rows] = await sequelize.query(
        'SELECT * FROM parcels_merged LIMIT 5;'
      );
      console.log('Sample rows from parcels_merged:');
      console.table(rows);
      console.log('Data looks OK');
    } else {
      console.warn('Data table is empty');
    }
  } catch (err) {
    console.error('Data check failed:', err);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  checkData();
}

module.exports = checkData;
