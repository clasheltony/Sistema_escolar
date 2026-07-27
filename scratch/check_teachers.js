require('dotenv').config();
const { Sequelize } = require('sequelize');
async function check() {
  const cloud = new Sequelize(process.env.DATABASE_URL, {dialect:'postgres', logging:false});
  await cloud.authenticate();
  const ts = await cloud.query('SELECT * FROM "Teachers"', {type:Sequelize.QueryTypes.SELECT});
  console.log(ts);
  await cloud.close();
}
check().catch(console.error);
