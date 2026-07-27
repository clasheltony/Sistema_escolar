require('dotenv').config();
const { Sequelize } = require('sequelize');

async function checkAll() {
  console.log('--- BUSCANDO NO SUPABASE (Nuvem) ---');
  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  
  await cloud.authenticate();
  const cloudTeachers = await cloud.query('SELECT id, email FROM "Teacher"', { type: Sequelize.QueryTypes.SELECT });
  console.log('Professores no Supabase:');
  cloudTeachers.forEach(t => console.log(` - ${t.email} (ID: ${t.id})`));
  
  const cloudClasses = await cloud.query('SELECT id, name, "teacherId" FROM "Class"', { type: Sequelize.QueryTypes.SELECT });
  console.log('\nTurmas no Supabase:');
  cloudClasses.forEach(c => console.log(` - Turma: ${c.name} | Pertence ao prof (ID): ${c.teacherId}`));
  await cloud.close();

  console.log('\n=========================================\n');

  console.log('--- BUSCANDO NO LOCAL (SQLite atual) ---');
  const local = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: false
  });
  
  await local.authenticate();
  const localTeachers = await local.query('SELECT id, email FROM Teachers', { type: Sequelize.QueryTypes.SELECT });
  console.log('Professores no Local:');
  localTeachers.forEach(t => console.log(` - ${t.email} (ID: ${t.id})`));
  
  const localClasses = await local.query('SELECT id, name, teacherId FROM Classes', { type: Sequelize.QueryTypes.SELECT });
  console.log('\nTurmas no Local:');
  localClasses.forEach(c => console.log(` - Turma: ${c.name} | Pertence ao prof (ID): ${c.teacherId}`));
  await local.close();
}

checkAll().catch(e => console.error(e.message));
