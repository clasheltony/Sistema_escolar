require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false
});

async function main() {
  await sequelize.authenticate();

  // Verificar tabelas existentes
  console.log('\n========================================');
  console.log('TABELAS NO BANCO DE DADOS');
  console.log('========================================');
  const [tables] = await sequelize.query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  tables.forEach(t => console.log(' -', t.name));

  // Verificar estrutura da tabela Bimesters
  console.log('\n========================================');
  console.log('ESTRUTURA DA TABELA Bimesters');
  console.log('========================================');
  try {
    const [cols] = await sequelize.query(`PRAGMA table_info(Bimesters)`);
    cols.forEach(c => console.log(`  ${c.cid}: ${c.name} (${c.type}) notnull=${c.notnull} default=${c.dflt_value}`));
  } catch(e) {
    console.log('  ERRO:', e.message);
  }

  // Contar registros em Bimesters
  console.log('\n========================================');
  console.log('CONTAGEM RAW DA TABELA Bimesters');
  console.log('========================================');
  try {
    const [count] = await sequelize.query(`SELECT COUNT(*) as total FROM Bimesters`);
    console.log('  Total:', count[0].total);

    const [all] = await sequelize.query(`SELECT * FROM Bimesters LIMIT 20`);
    console.log('  Registros:');
    all.forEach(b => console.log('  ', JSON.stringify(b)));
  } catch(e) {
    console.log('  ERRO:', e.message);
  }

  // Verificar teachers
  console.log('\n========================================');
  console.log('TEACHERS');
  console.log('========================================');
  const [teachers] = await sequelize.query(`SELECT id, name, role FROM Teachers ORDER BY name`);
  teachers.forEach(t => console.log(`  [${t.role}] ${t.name} | ID: ${t.id}`));

  // Verificar se Attendance tem campo bimesterId
  console.log('\n========================================');
  console.log('ESTRUTURA DA TABELA Attendances');
  console.log('========================================');
  const [attCols] = await sequelize.query(`PRAGMA table_info(Attendances)`);
  attCols.forEach(c => console.log(`  ${c.cid}: ${c.name} (${c.type})`));

  // Verificar se Grade tem campo bimesterId
  console.log('\n========================================');
  console.log('ESTRUTURA DA TABELA Grades');
  console.log('========================================');
  const [gradeCols] = await sequelize.query(`PRAGMA table_info(Grades)`);
  gradeCols.forEach(c => console.log(`  ${c.cid}: ${c.name} (${c.type})`));

  // Verificar frequências duplicadas
  console.log('\n========================================');
  console.log('FREQUÊNCIAS DUPLICADAS (mesmo aluno, data, turma)');
  console.log('========================================');
  const [dupFreq] = await sequelize.query(`
    SELECT studentId, date, classId, COUNT(*) as qtd
    FROM Attendances
    GROUP BY studentId, date, classId
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  if (dupFreq.length === 0) {
    console.log('  Nenhuma frequência duplicada (por studentId+date+classId).');
  } else {
    console.log(`  ${dupFreq.length} combinações duplicadas!`);
    dupFreq.slice(0,5).forEach(d => console.log(`  StudentId: ${d.studentId} | Data: ${d.date} | qtd: ${d.qtd}`));
  }

  // Verificar frequências duplicadas por lesson
  console.log('\n========================================');
  console.log('FREQUÊNCIAS DUPLICADAS (mesmo aluno, data, turma, lessonNumber)');
  console.log('========================================');
  const [dupFreq2] = await sequelize.query(`
    SELECT studentId, date, classId, lessonNumber, COUNT(*) as qtd
    FROM Attendances
    GROUP BY studentId, date, classId, lessonNumber
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  if (dupFreq2.length === 0) {
    console.log('  Nenhuma frequência duplicada (por studentId+date+classId+lessonNumber).');
  } else {
    console.log(`  ${dupFreq2.length} combinações duplicadas!`);
    dupFreq2.slice(0,10).forEach(d => {
      console.log(`  StudentId: ${d.studentId} | Data: ${d.date} | Lesson: ${d.lessonNumber} | qtd: ${d.qtd}`);
    });
  }

  // Verificar a lógica: como o relatório de semestre lê frequências
  // O problema pode ser que bimesters está vazio, então b1/b2 não existem
  console.log('\n========================================');
  console.log('ANÁLISE: O relatório de semestre usa os bimestres para filtrar frequência.');
  console.log('Se Bimesters está vazio → bimesters[] vazio → b1/b2 = undefined → sem dados!');
  console.log('========================================');

  await sequelize.close();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
