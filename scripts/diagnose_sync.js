require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');

(async () => {
  // 1. Connect to Supabase
  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await cloud.authenticate();
  console.log('Supabase: OK');

  // 2. List all teachers in Supabase
  const teachers = await cloud.query('SELECT id, email, name, role FROM "Teacher"', {
    type: Sequelize.QueryTypes.SELECT
  });
  console.log('\nProfessores no Supabase:');
  teachers.forEach(t => console.log(`  ${t.email} (${t.role})`));

  // 3. Check Tony specifically
  const [tony] = await cloud.query(
    'SELECT id, email, name, password, role FROM "Teacher" WHERE email = ?',
    { replacements: ['tonyferreira13@gmail.com'], type: Sequelize.QueryTypes.SELECT }
  );
  if (tony) {
    const match = bcrypt.compareSync('LET013509ici@', tony.password);
    console.log(`\nTony: ${match ? 'senha OK' : 'senha NAO CONFIRMA'}`);
    console.log(`  role: ${tony.role}`);
  } else {
    console.log('\nTony NAO encontrado no Supabase!');
  }

  // 4. Now check if the app would find Tony via sync
  // The app creates models with freezeTableName - check table name
  try {
    const [tPlural] = await cloud.query('SELECT COUNT(*) as n FROM "Teachers"', { type: Sequelize.QueryTypes.SELECT });
    console.log(`\nTabela "Teachers" (plural): ${tPlural.n} registros`);
  } catch(e) {
    console.log('\nTabela "Teachers" (plural): nao existe');
  }

  await cloud.close();
})();
