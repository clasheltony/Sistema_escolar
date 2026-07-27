require('dotenv').config();
const { Sequelize } = require('sequelize');

async function checkTables() {
  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  
  await cloud.authenticate();
  
  console.log('--- TABELAS NO PLURAL ---');
  const plurals = ['Teachers', 'Classes', 'Students', 'Attendances', 'Grades'];
  for (const t of plurals) {
    try {
      const res = await cloud.query(`SELECT COUNT(*) as n FROM "${t}"`, {type:Sequelize.QueryTypes.SELECT});
      console.log(`${t}: ${res[0].n} registros`);
    } catch(e) {
      console.log(`${t}: Nao existe ou erro (${e.message})`);
    }
  }
  
  console.log('\n--- TABELAS NO SINGULAR ---');
  const singulars = ['Teacher', 'Class', 'Student', 'Attendance', 'Grade'];
  for (const t of singulars) {
    try {
      const res = await cloud.query(`SELECT COUNT(*) as n FROM "${t}"`, {type:Sequelize.QueryTypes.SELECT});
      console.log(`${t}: ${res[0].n} registros`);
    } catch(e) {
      console.log(`${t}: Nao existe ou erro (${e.message})`);
    }
  }
  
  // Vamos ver quais turmas tem na tabela Classes
  try {
    const res = await cloud.query(`SELECT id, name, "teacherId" FROM "Classes"`, {type:Sequelize.QueryTypes.SELECT});
    console.log(`\nTurmas na tabela Classes (Plural): ${res.length}`);
    res.forEach(c => console.log(` - ${c.name} (teacherId: ${c.teacherId})`));
  } catch(e) {}
  
  await cloud.close();
}

checkTables().catch(console.error);
