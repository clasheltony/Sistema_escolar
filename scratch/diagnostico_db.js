require('dotenv').config();
const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false
});

async function main() {
  await sequelize.authenticate();

  // =============================================
  // 1. VERIFICAR BIMESTRES DUPLICADOS
  // =============================================
  console.log('\n========================================');
  console.log('1. BIMESTRES - TODOS OS REGISTROS');
  console.log('========================================');

  const [bimestres] = await sequelize.query(`
    SELECT b.id, b.name, b.startDate, b.endDate, b.teacherId, t.name as teacherName
    FROM Bimesters b
    LEFT JOIN Teachers t ON b.teacherId = t.id
    ORDER BY t.name, b.name
  `);

  bimestres.forEach(b => {
    console.log(`  [${b.teacherName || 'SEM TEACHER'}] ${b.name} | ${b.startDate} -> ${b.endDate} | ID: ${b.id}`);
  });

  console.log('\n========================================');
  console.log('2. BIMESTRES DUPLICADOS (mesmo nome por professor)');
  console.log('========================================');
  const [duplicados] = await sequelize.query(`
    SELECT teacherId, name, COUNT(*) as qtd
    FROM Bimesters
    GROUP BY teacherId, name
    HAVING COUNT(*) > 1
  `);

  if (duplicados.length === 0) {
    console.log('  Nenhum duplicado encontrado por (teacherId + name).');
  } else {
    duplicados.forEach(d => {
      console.log(`  TeacherId: ${d.teacherId} | Nome: ${d.name} | Quantidade: ${d.qtd}`);
    });
  }

  console.log('\n========================================');
  console.log('3. QUANTIDADE DE BIMESTRES POR PROFESSOR');
  console.log('========================================');
  const [porProf] = await sequelize.query(`
    SELECT b.teacherId, t.name as teacherName, COUNT(*) as total
    FROM Bimesters b
    LEFT JOIN Teachers t ON b.teacherId = t.id
    GROUP BY b.teacherId
    ORDER BY t.name
  `);
  porProf.forEach(p => {
    console.log(`  ${p.teacherName || 'SEM NOME'} -> ${p.total} bimestres`);
  });

  // =============================================
  // 2. VERIFICAR LANÇAMENTOS DE FREQUÊNCIA
  // =============================================
  console.log('\n========================================');
  console.log('4. FREQUÊNCIAS - TOTAL GERAL');
  console.log('========================================');
  const [totalFreq] = await sequelize.query(`SELECT COUNT(*) as total FROM Attendances`);
  console.log(`  Total de registros de frequência: ${totalFreq[0].total}`);

  console.log('\n========================================');
  console.log('5. FREQUÊNCIAS POR PERÍODO (distribuição por mês)');
  console.log('========================================');
  const [freqPorMes] = await sequelize.query(`
    SELECT strftime('%Y-%m', date) as mes, COUNT(*) as qtd
    FROM Attendances
    GROUP BY mes
    ORDER BY mes
  `);
  freqPorMes.forEach(f => {
    console.log(`  ${f.mes}: ${f.qtd} registros`);
  });

  console.log('\n========================================');
  console.log('6. FREQUÊNCIAS DO 1º SEMESTRE (fev-jul 2026)');
  console.log('========================================');
  const [freq1Sem] = await sequelize.query(`
    SELECT COUNT(*) as total, status
    FROM Attendances
    WHERE date BETWEEN '2026-02-10' AND '2026-07-23'
    GROUP BY status
  `);
  if (freq1Sem.length === 0) {
    console.log('  ⚠️  NENHUM registro de frequência encontrado no 1º semestre (02/02 - 23/07)!');
  } else {
    freq1Sem.forEach(f => console.log(`  Status ${f.status}: ${f.total}`));
  }

  console.log('\n========================================');
  console.log('7. DATAS MÍNIMA E MÁXIMA DE FREQUÊNCIA');
  console.log('========================================');
  const [minmax] = await sequelize.query(`
    SELECT MIN(date) as minDate, MAX(date) as maxDate FROM Attendances
  `);
  console.log(`  Data mais antiga: ${minmax[0].minDate}`);
  console.log(`  Data mais recente: ${minmax[0].maxDate}`);

  console.log('\n========================================');
  console.log('8. SAMPLE - PRIMEIROS 10 REGISTROS DE FREQUÊNCIA');
  console.log('========================================');
  const [sample] = await sequelize.query(`
    SELECT a.id, a.date, a.status, a.classId, s.name as studentName
    FROM Attendances a
    LEFT JOIN Students s ON a.studentId = s.id
    ORDER BY a.date ASC
    LIMIT 10
  `);
  sample.forEach(a => {
    console.log(`  ${a.date} | ${a.status} | Aluno: ${a.studentName} | ClassId: ${a.classId}`);
  });

  console.log('\n========================================');
  console.log('9. TURMAS / CLASSES EXISTENTES');
  console.log('========================================');
  const [classes] = await sequelize.query(`
    SELECT c.id, c.name, c.teacherId, t.name as teacherName, COUNT(s.id) as totalAlunos
    FROM Classes c
    LEFT JOIN Teachers t ON c.teacherId = t.id
    LEFT JOIN Students s ON s.classId = c.id
    GROUP BY c.id
    ORDER BY t.name, c.name
  `);
  classes.forEach(c => {
    console.log(`  [${c.teacherName}] ${c.name} | ${c.totalAlunos} alunos | ID: ${c.id}`);
  });

  console.log('\n========================================');
  console.log('10. FREQUÊNCIAS POR TURMA (1º semestre)');
  console.log('========================================');
  const [freqPorTurma] = await sequelize.query(`
    SELECT c.name as className, COUNT(a.id) as total
    FROM Attendances a
    JOIN Classes c ON a.classId = c.id
    WHERE a.date BETWEEN '2026-02-01' AND '2026-07-31'
    GROUP BY a.classId
    ORDER BY c.name
  `);
  if (freqPorTurma.length === 0) {
    console.log('  ⚠️  Nenhuma frequência no 1º semestre por turma.');
  } else {
    freqPorTurma.forEach(f => console.log(`  ${f.className}: ${f.total} registros`));
  }

  console.log('\n========================================');
  console.log('11. NOTAS - DISTRIBUIÇÃO GERAL');
  console.log('========================================');
  const [notasPorMes] = await sequelize.query(`
    SELECT strftime('%Y-%m', date) as mes, COUNT(*) as qtd
    FROM Grades
    GROUP BY mes
    ORDER BY mes
  `);
  notasPorMes.forEach(n => console.log(`  ${n.mes}: ${n.qtd} notas`));

  await sequelize.close();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
