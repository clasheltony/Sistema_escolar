require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

async function main() {
  await sequelize.authenticate();
  console.log('✅ Conectado ao banco de dados.\n');

  // =============================================
  // CORREÇÃO 1: REMOVER FREQUÊNCIAS DUPLICADAS
  // (sem triggers - query direta sem hooks do Sequelize)
  // =============================================
  console.log('========================================');
  console.log('CORREÇÃO 1: REMOVER FREQUÊNCIAS DUPLICADAS');
  console.log('========================================');

  // Desabilitar triggers/foreign keys temporariamente para evitar o problema
  await sequelize.query(`PRAGMA foreign_keys = OFF`);

  // Identificar IDs a manter: para cada grupo duplicado, manter o de createdAt menor
  const [dupGroups] = await sequelize.query(`
    SELECT studentId, date, classId, lessonNumber
    FROM Attendances
    GROUP BY studentId, date, classId, lessonNumber
    HAVING COUNT(*) > 1
  `);

  console.log(`  Grupos duplicados encontrados: ${dupGroups.length}`);

  let totalRemovidos = 0;
  const idsParaManter = [];

  for (const group of dupGroups) {
    const [registros] = await sequelize.query(`
      SELECT id FROM Attendances
      WHERE studentId = '${group.studentId}' 
        AND date = '${group.date}' 
        AND classId = '${group.classId}' 
        AND lessonNumber = ${group.lessonNumber}
      ORDER BY createdAt ASC
    `);

    // Manter apenas o primeiro (mais antigo)
    idsParaManter.push(registros[0].id);
    const extras = registros.slice(1).map(r => r.id);
    totalRemovidos += extras.length;

    // Deletar cada extra individualmente (sem triggers)
    for (const id of extras) {
      await sequelize.query(`DELETE FROM Attendances WHERE id = '${id}'`);
    }
  }

  await sequelize.query(`PRAGMA foreign_keys = ON`);

  console.log(`  ✅ ${totalRemovidos} registros duplicados removidos.`);
  const [totalApos] = await sequelize.query(`SELECT COUNT(*) as total FROM Attendances`);
  console.log(`  Total de frequências agora: ${totalApos[0].total}`);

  // =============================================
  // CORREÇÃO 2: CRIAR BIMESTRES PARA CADA PROFESSOR
  // =============================================
  console.log('\n========================================');
  console.log('CORREÇÃO 2: CRIAR BIMESTRES PARA PROFESSORES');
  console.log('========================================');

  const [teachers] = await sequelize.query(
    `SELECT id, name, role FROM Teachers WHERE role = 'professor'`
  );

  console.log(`  Professores encontrados: ${teachers.length}`);

  for (const teacher of teachers) {
    const [existing] = await sequelize.query(
      `SELECT COUNT(*) as total FROM Bimesters WHERE teacherId = '${teacher.id}'`
    );

    if (parseInt(existing[0].total) > 0) {
      console.log(`  ⚠️  ${teacher.name}: já possui ${existing[0].total} bimestres. Pulando.`);
      continue;
    }

    const bimestres = [
      { name: '1º Bimestre', startDate: '2026-02-10', endDate: '2026-04-23' },
      { name: '2º Bimestre', startDate: '2026-04-24', endDate: '2026-07-23' },
      { name: '3º Bimestre', startDate: '2026-07-24', endDate: '2026-10-05' },
      { name: '4º Bimestre', startDate: '2026-10-06', endDate: '2026-12-17' },
    ];

    for (const b of bimestres) {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      await sequelize.query(`
        INSERT INTO Bimesters (id, name, startDate, endDate, teacherId, createdAt, updatedAt)
        VALUES ('${newId}', '${b.name}', '${b.startDate}', '${b.endDate}', '${teacher.id}', '${now}', '${now}')
      `);
    }
    console.log(`  ✅ ${teacher.name}: 4 bimestres criados.`);
  }

  // Resultado dos bimestres
  console.log('\n  Bimestres no banco:');
  const [allBim] = await sequelize.query(`
    SELECT b.name, b.startDate, b.endDate, t.name as teacherName
    FROM Bimesters b
    LEFT JOIN Teachers t ON b.teacherId = t.id
    ORDER BY t.name, b.name
  `);
  allBim.forEach(b => {
    console.log(`    [${b.teacherName}] ${b.name}: ${b.startDate} → ${b.endDate}`);
  });

  // =============================================
  // VERIFICAÇÃO FINAL
  // =============================================
  console.log('\n========================================');
  console.log('VERIFICAÇÃO FINAL');
  console.log('========================================');

  const [freqB1] = await sequelize.query(
    `SELECT COUNT(*) as total FROM Attendances WHERE date BETWEEN '2026-02-10' AND '2026-04-23'`
  );
  console.log(`  Freq. 1º Bimestre (10/02-23/04): ${freqB1[0].total} registros`);

  const [freqB2] = await sequelize.query(
    `SELECT COUNT(*) as total FROM Attendances WHERE date BETWEEN '2026-04-24' AND '2026-07-23'`
  );
  console.log(`  Freq. 2º Bimestre (24/04-23/07): ${freqB2[0].total} registros`);

  const [freqSem1] = await sequelize.query(
    `SELECT COUNT(*) as total FROM Attendances WHERE date BETWEEN '2026-02-10' AND '2026-07-23'`
  );
  console.log(`  Freq. 1º Semestre total: ${freqSem1[0].total} registros`);

  const [dupCheck] = await sequelize.query(`
    SELECT COUNT(*) as total FROM (
      SELECT studentId FROM Attendances
      GROUP BY studentId, date, classId, lessonNumber
      HAVING COUNT(*) > 1
    )
  `);
  console.log(`  Duplicatas restantes: ${dupCheck[0].total} (deve ser 0)`);

  console.log('\n✅ Todas as correções aplicadas com sucesso!');

  await sequelize.close();
}

main().catch(err => {
  console.error('ERRO:', err.message, err.stack);
  process.exit(1);
});
