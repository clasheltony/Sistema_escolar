const { Sequelize } = require('sequelize');
const path = require('path');
const seq = new Sequelize({ dialect: 'sqlite', storage: path.join(__dirname, '..', 'database.sqlite'), logging: false });

async function main() {
  const tables = await seq.query("SELECT name FROM sqlite_master WHERE type='table'", { type: Sequelize.QueryTypes.SELECT });
  console.log('Tabelas:', tables.map(t => t.name));

  const tableInfo = await seq.query('PRAGMA table_info(Classes)', { type: Sequelize.QueryTypes.SELECT });
  console.log('Colunas da tabela Classes:', JSON.stringify(tableInfo, null, 2));

  const teacherIdCol = tableInfo.find(c => c.name === 'teacherId');
  if (teacherIdCol) {
    console.log('teacherId nullable?', teacherIdCol.notnull === 0 ? 'YES' : 'NO (need to change)');
    if (teacherIdCol.notnull !== 0) {
      console.log('Altering schema...');
      await seq.query('PRAGMA foreign_keys=off');
      await seq.query('BEGIN TRANSACTION');
      await seq.query('ALTER TABLE Classes RENAME TO Classes_old');
      await seq.query('CREATE TABLE Classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT, teacherId TEXT, createdAt DATE, updatedAt DATE)');
      await seq.query('INSERT INTO Classes (id, name, subject, teacherId, createdAt, updatedAt) SELECT id, name, subject, teacherId, createdAt, updatedAt FROM Classes_old');
      await seq.query('DROP TABLE Classes_old');
      await seq.query('COMMIT');
      await seq.query('PRAGMA foreign_keys=on');
      console.log('Schema altered!');
    }
  } else {
    console.log('teacherId column not found');
  }

  process.exit();
}

main().catch(e => { console.error(e); process.exit(1); });
