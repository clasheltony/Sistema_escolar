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
  const backupRows = await local.query(`SELECT "id", "status" FROM "Attendances"`, { type: Sequelize.QueryTypes.SELECT });
  const statusById = new Map(backupRows.map(r => [r.id, r.status]));
  await local.close();

  const conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await conn.authenticate();

  const invalid = await conn.query(
    `SELECT "id", "status" FROM "Attendances" WHERE "status" <> 'Presente' AND "status" <> 'Ausente'`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Registros inválidos restantes: ${invalid.length}`);

  let fixed = 0, noRef = 0;
  for (let i = 0; i < invalid.length; i += BATCH) {
    const chunk = invalid.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const rec of chunk) {
      const correct = statusById.get(rec.id);
      if (!correct) { noRef++; continue; }
      values.push(`($${p}::uuid, $${p + 1}::text)`);
      params.push(rec.id, correct);
      p += 2;
    }
    if (values.length === 0) continue;
    const sql =
      `UPDATE "Attendances" AS a SET "status" = v.status, "updatedAt" = now() ` +
      `FROM (VALUES ${values.join(',')}) AS v(id, status) WHERE a."id" = v.id`;
    await conn.query(sql, { bind: params });
    fixed += values.length;
    console.log(`  lote ${i / BATCH + 1}: +${values.length} (total ${fixed})`);
  }

  console.log('\n=== RESULTADO ===');
  console.log(`Corrigidos: ${fixed}`);
  console.log(`Sem referência no backup: ${noRef}`);

  const check = await conn.query(`SELECT status, COUNT(*) as n FROM "Attendances" GROUP BY status`, { type: Sequelize.QueryTypes.SELECT });
  console.log('\nStatus na produção agora:');
  check.forEach(r => console.log(`  '${r.status}' -> ${r.n}`));

  await conn.close();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
