const { Sequelize } = require('sequelize');
const path = require('path');
const seq = new Sequelize({ dialect: 'sqlite', storage: path.join(__dirname, '..', 'database.sqlite'), logging: false });

(async () => {
  const tables = await seq.getQueryInterface().showAllTables();
  console.log('=== TABELAS ===');
  for (const table of tables) {
    const r = await seq.query('SELECT COUNT(*) as c FROM "' + table + '"', { type: Sequelize.QueryTypes.SELECT });
    console.log('  ' + table + ': ' + r[0].c + ' registros');
  }

  console.log('\n=== PROFESSORES ===');
  const teachers = await seq.query('SELECT id, name, email, role FROM Teachers', { type: Sequelize.QueryTypes.SELECT });
  for (const t of teachers) {
    console.log('  ' + t.name + ' | ' + t.email + ' | papel: ' + t.role + ' | id: ' + t.id.substring(0, 8) + '...');
  }

  console.log('\n=== TURMAS ===');
  const classes = await seq.query('SELECT id, name, subject, teacherId FROM Classes', { type: Sequelize.QueryTypes.SELECT });
  for (const c of classes) {
    console.log('  ' + c.name + ' | ' + (c.subject || 'sem disciplina') + ' | teacherId: ' + (c.teacherId ? c.teacherId.substring(0, 8) + '...' : 'NULL'));
  }

  await seq.close();
})();
