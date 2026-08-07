require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function main() {
  const isCloud = !!process.env.DATABASE_URL;
  console.log(`Modo: ${isCloud ? 'CLOUD (Postgres/Supabase)' : 'LOCAL (SQLite)'}`);

  const sequelize = isCloud
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        logging: false
      })
    : new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '..', 'database.sqlite'),
        logging: false
      });

  await sequelize.authenticate();
  console.log('Conectado.\n');

  const [cols] = await sequelize.query(`PRAGMA table_info("Attendances")`).catch(() => [[null]]);
  if (cols[0]) {
    console.log('=== Colunas de Attendances (SQLite) ===');
    cols.forEach(c => console.log(`  ${c.name}: ${c.type}`));
  } else {
    try {
      const r = await sequelize.query(
        `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='Attendances' ORDER BY ordinal_position`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      console.log('=== Colunas de Attendances (Postgres) ===');
      r.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`));
    } catch (e) {
      console.log('Não foi possível ler o schema de Attendances:', e.message);
    }
  }

  console.log('\n=== 1. Tipos/valores de status ===');
  const st = await sequelize.query('SELECT status, COUNT(*) as n FROM "Attendances" GROUP BY status', { type: Sequelize.QueryTypes.SELECT });
  st.forEach(s => console.log(`  status='${s.status}' -> ${s.n}`));

  console.log('\n=== 2. Frequências órfãs (studentId sem aluno correspondente) ===');
  try {
    const [orphans] = await sequelize.query(
      `SELECT COUNT(*) as n FROM "Attendances" a LEFT JOIN "Students" s ON a."studentId" = s."id" WHERE s."id" IS NULL`
    );
    console.log(`  Total órfãs: ${orphans[0].n}`);
  } catch (e) { console.log('  Erro:', e.message); }

  console.log('\n=== 3. Tipos de studentId vs id de Students ===');
  try {
    const sampleAtt = await sequelize.query('SELECT "studentId", "classId" FROM "Attendances" WHERE "studentId" IS NOT NULL LIMIT 5', { type: Sequelize.QueryTypes.SELECT });
    const sampleStu = await sequelize.query('SELECT "id" FROM "Students" LIMIT 5', { type: Sequelize.QueryTypes.SELECT });
    console.log('  Attendances.studentId (amostra):', sampleAtt.map(r => r.studentId + ' [' + typeof r.studentId + ']'));
    console.log('  Students.id       (amostra):', sampleStu.map(r => r.id + ' [' + typeof r.id + ']'));
    const sampleCls = await sequelize.query('SELECT "id", "name" FROM "Classes" LIMIT 5', { type: Sequelize.QueryTypes.SELECT });
    console.log('  Classes.id        (amostra):', sampleCls.map(r => r.id + ' [' + typeof r.id + ']'));
  } catch (e) { console.log('  Erro:', e.message); }

  console.log('\n=== 4. Verificação de renderização (turma com maior nº de chamadas) ===');
  try {
    const [top] = await sequelize.query(
      `SELECT "classId", COUNT(*) as n FROM "Attendances" GROUP BY "classId" ORDER BY n DESC LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (top) {
      const classId = top.classId;
      const students = await sequelize.query('SELECT "id", "name" FROM "Students" WHERE "classId" = ?', { bind: [classId], type: Sequelize.QueryTypes.SELECT }).catch(async () =>
        await sequelize.query('SELECT "id", "name" FROM "Students" WHERE "classId" = $1', { bind: [classId], type: Sequelize.QueryTypes.SELECT })
      );
      const atts = await sequelize.query('SELECT "date", "lessonNumber", "status", "studentId" FROM "Attendances" WHERE "classId" = ?', { bind: [classId], type: Sequelize.QueryTypes.SELECT }).catch(async () =>
        await sequelize.query('SELECT "date", "lessonNumber", "status", "studentId" FROM "Attendances" WHERE "classId" = $1', { bind: [classId], type: Sequelize.QueryTypes.SELECT })
      );

      const history = {};
      const dates = new Set();
      atts.forEach(a => {
        dates.add(a.date);
        const d = String(a.date).slice(0, 10);
        history[d] = history[d] || {};
        history[d][a.studentId] = history[d][a.studentId] || {};
        history[d][a.studentId][a.lessonNumber] = a.status;
      });

      let ok = 0, miss = 0;
      const dateList = [...dates].sort().reverse();
      students.forEach(s => {
        if (!dateList[0]) return;
        const st0 = history[String(dateList[0]).slice(0, 10)] || {};
        if (st0[s.id]) ok++; else miss++;
      });

      console.log(`  Turma: ${classId} | alunos: ${students.length} | dias: ${dates.size}`);
      console.log(`  No dia mais recente (${dateList[0]}):`);
      console.log(`    alunos com status renderizável: ${ok}`);
      console.log(`    alunos SEM status (apareceriam "-"): ${miss}`);
      if (miss > 0 && students.length > 0) {
        console.log(`  AMOSTRA de studentId em Attendances nesse dia:`, Object.keys(history[String(dateList[0]).slice(0, 10)] || {}).slice(0, 3));
        console.log(`  AMOSTRA de id em Students da turma:`, students.slice(0, 3).map(s => s.id));
      }
    } else {
      console.log('  Nenhuma frequência encontrada.');
    }
  } catch (e) {
    console.log('  Erro:', e.message);
  }

  await sequelize.close();
  console.log('\nDiagnóstico concluído.');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
