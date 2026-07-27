const { Sequelize } = require('sequelize');
const path = require('path');

const backup = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite.backup.20260724_083513'),
  logging: false
});

async function inspect() {
  await backup.authenticate();
  
  const [classes] = await backup.query('SELECT * FROM Classes');
  console.log(`=== TODAS AS TURMAS NO BACKUP (${classes.length}) ===`);
  classes.forEach(c => console.log(`  id:${c.id} | nome: ${c.name} | teacherId: ${c.teacherId}`));

  const [students] = await backup.query('SELECT * FROM Students');
  console.log(`\n=== ALUNOS NO BACKUP (${students.length}) ===`);

  const [att] = await backup.query('SELECT COUNT(*) as n FROM Attendances');
  console.log(`\n=== CHAMADAS NO BACKUP (${att[0].n}) ===`);

  const [grades] = await backup.query('SELECT COUNT(*) as n FROM Grades');
  console.log(`\n=== NOTAS NO BACKUP (${grades[0].n}) ===`);
}

inspect().catch(e => console.error(e));
