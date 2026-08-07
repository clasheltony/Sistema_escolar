require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const BACKUP_PATH = path.join(__dirname, '..', 'database.sqlite.backup.2026-08-05T00-09-27');
const BATCH = 500;

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL não definido.'); process.exit(1); }

  const local = new Sequelize({ dialect: 'sqlite', storage: BACKUP_PATH, logging: false });
  await local.authenticate();
  const backupRows = await local.query(`SELECT "id" FROM "Attendances"`, { type: Sequelize.QueryTypes.SELECT });
  const backupIds = new Set(backupRows.map(r => r.id));
  await local.close();
  console.log(`Backup: ${backupIds.size} IDs.`);

  const conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await conn.authenticate();

  const dups = await conn.query(
    `SELECT "studentId", date, "classId", "lessonNumber" FROM "Attendances" ` +
    `GROUP BY 1,2,3,4 HAVING COUNT(*) > 1`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Grupos duplicados: ${dups.length}`);

  let toDelete = [];
  for (const g of dups) {
    const recs = await conn.query(
      `SELECT "id", "createdAt" FROM "Attendances" ` +
      `WHERE "studentId"=$1 AND date=$2 AND "classId"=$3 AND "lessonNumber"=$4 ORDER BY "createdAt" ASC`,
      { bind: [g.studentId, g.date, g.classId, g.lessonNumber], type: Sequelize.QueryTypes.SELECT }
    );

    let keep = null;
    for (const r of recs) {
      if (backupIds.has(r.id)) { keep = r; break; }
    }
    if (!keep) keep = recs[0]; // nenhum no backup: mantém o mais antigo

    const extras = recs.filter(r => r.id !== keep.id).map(r => r.id);
    toDelete.push(...extras);
    console.log(`  ${g.date} | aluno ${g.studentId.slice(0, 8)} | aula ${g.lessonNumber} | mantendo ${keep.id.slice(0, 8)} | removendo ${extras.length}`);
  }

  console.log(`\nTotal a remover: ${toDelete.length}`);
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const chunk = toDelete.slice(i, i + BATCH);
    const params = chunk.map((_, k) => `$${k + 1}`);
    await conn.query(`DELETE FROM "Attendances" WHERE "id" IN (${params.join(',')})`, { bind: chunk });
    console.log(`  removidos lote ${i / BATCH + 1}: ${chunk.length}`);
  }

  const check = await conn.query(`SELECT COUNT(*) as n FROM "Attendances"`, { type: Sequelize.QueryTypes.SELECT });
  console.log(`\nTotal de frequências na produção agora: ${check[0].n}`);

  const dupCheck = await conn.query(
    `SELECT COUNT(*) as n FROM (SELECT 1 FROM "Attendances" GROUP BY "studentId",date,"classId","lessonNumber" HAVING COUNT(*)>1) x`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Grupos duplicados restantes: ${dupCheck[0].n}`);

  await conn.close();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
