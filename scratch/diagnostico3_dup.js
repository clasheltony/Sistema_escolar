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

  // Contar total de frequências duplicadas
  console.log('\n========================================');
  console.log('ANÁLISE COMPLETA DE FREQUÊNCIAS DUPLICADAS');
  console.log('========================================');
  const [dupAll] = await sequelize.query(`
    SELECT studentId, date, classId, lessonNumber, COUNT(*) as qtd
    FROM Attendances
    GROUP BY studentId, date, classId, lessonNumber
    HAVING COUNT(*) > 1
  `);
  console.log(`  Total de grupos duplicados: ${dupAll.length}`);
  const totalExtras = dupAll.reduce((s, d) => s + (d.qtd - 1), 0);
  console.log(`  Total de registros extras (a remover): ${totalExtras}`);

  // Verificar quantos alunos têm duplicatas
  const alunosDup = new Set(dupAll.map(d => d.studentId));
  console.log(`  Alunos afetados: ${alunosDup.size}`);

  // Verificar distribuição por data
  console.log('\n  Distribuição por data:');
  const byDate = {};
  dupAll.forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = 0;
    byDate[d.date]++;
  });
  Object.entries(byDate).sort().forEach(([date, count]) => {
    console.log(`    ${date}: ${count} grupos duplicados`);
  });

  // Verificar IDs duplicados - pegar ambos os IDs para cada par
  console.log('\n========================================');
  console.log('AMOSTRA DE DUPLICATAS - COM IDs');
  console.log('========================================');
  const [dup5] = await sequelize.query(`
    SELECT a.id, a.studentId, a.date, a.classId, a.lessonNumber, a.status, a.createdAt,
           s.name as studentName
    FROM Attendances a
    JOIN Students s ON a.studentId = s.id
    WHERE (a.studentId, a.date, a.classId, a.lessonNumber) IN (
      SELECT studentId, date, classId, lessonNumber
      FROM Attendances
      GROUP BY studentId, date, classId, lessonNumber
      HAVING COUNT(*) > 1
    )
    ORDER BY a.studentId, a.date, a.lessonNumber, a.createdAt
    LIMIT 20
  `);
  dup5.forEach(a => {
    console.log(`  [${a.createdAt}] ID: ${a.id} | Aluno: ${a.studentName} | Data: ${a.date} | Lesson: ${a.lessonNumber} | ${a.status}`);
  });

  // Verificar total de frequências após limpeza
  const [totalAtual] = await sequelize.query(`SELECT COUNT(*) as total FROM Attendances`);
  console.log(`\n  Total atual: ${totalAtual[0].total}`);
  console.log(`  Total após limpeza: ${totalAtual[0].total - totalExtras}`);

  // Verificar a tabela Students_backup
  console.log('\n========================================');
  console.log('TABELA Students_backup');
  console.log('========================================');
  const [backupCount] = await sequelize.query(`SELECT COUNT(*) as total FROM Students_backup`);
  console.log(`  Total na backup: ${backupCount[0].total}`);
  const [backupSample] = await sequelize.query(`SELECT * FROM Students_backup LIMIT 3`);
  if (backupSample.length > 0) {
    console.log('  Colunas:', Object.keys(backupSample[0]).join(', '));
  }

  await sequelize.close();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
