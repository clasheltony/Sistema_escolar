require('dotenv').config();
const { Sequelize } = require('sequelize');

async function check() {
  const local = new Sequelize({dialect:'sqlite', storage:'database.sqlite', logging:false});
  await local.authenticate();
  const q = await local.query('SELECT COUNT(*) as n FROM SyncQueues WHERE synced=0', {type:Sequelize.QueryTypes.SELECT});
  console.log('Pendentes no SyncQueue local:', q[0].n);
  const errs = await local.query('SELECT COUNT(*) as n FROM SyncQueues WHERE syncError IS NOT NULL', {type:Sequelize.QueryTypes.SELECT});
  console.log('Erros no SyncQueue local:', errs[0].n);
  const t = await local.query('SELECT id, email, password FROM Teachers WHERE email="tonyferreira13@gmail.com"', {type:Sequelize.QueryTypes.SELECT});
  console.log('Tony local:', t[0]);
  await local.close();

  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect:'postgres', logging:false, dialectOptions:{ssl:{require:true,rejectUnauthorized:false}}
  });
  await cloud.authenticate();
  const ct = await cloud.query('SELECT id, email, password FROM "Teacher" WHERE email=\'tonyferreira13@gmail.com\'', {type:Sequelize.QueryTypes.SELECT});
  console.log('Tony no Supabase (singular):', ct[0] || 'NÃO ENCONTRADO');
  await cloud.close();
}
check().catch(console.error);
