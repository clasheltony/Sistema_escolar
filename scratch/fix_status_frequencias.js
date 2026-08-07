require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const BACKUP_PATH = path.join(__dirname, '..', 'database.sqlite.backup.2026-08-05T00-09-27');
const DUMP_PATH = path.join(__dirname, '..', 'dump_attendances_producao.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido. Crie o arquivo .env baseado no .env.example.');
    process.exit(1);
  }

  // 1) Ler o backup (fonte da verdade) -> id => status
  const local = new Sequelize({ dialect: 'sqlite', storage: BACKUP_PATH, logging: false });
  await local.authenticate();
  const backupRows = await local.query(
    `SELECT "id", "status" FROM "Attendances"`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  const statusById = new Map(backupRows.map(r => [r.id, r.status]));
  await local.close();
  console.log(`Backup lido: ${backupRows.length} registros.`);

  // 2) Conectar na produção
  const conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await conn.authenticate();
  console.log('Conectado à produção.\n');

  // 3) Backup de segurança da tabela Attendances da produção
  const all = await conn.query(`SELECT * FROM "Attendances"`, { type: Sequelize.QueryTypes.SELECT });
  fs.writeFileSync(DUMP_PATH, JSON.stringify(all, null, 2));
  console.log(`Backup de segurança salvo em: ${DUMP_PATH} (${all.length} registros)`);

  // 4) Localizar registros com status inválido ('false')
  const invalid = all.filter(r => r.status !== 'Presente' && r.status !== 'Ausente');
  console.log(`Registros com status inválido: ${invalid.length}\n`);

  let fixed = 0, noRef = 0;
  for (const rec of invalid) {
    const correct = statusById.get(rec.id);
    if (!correct) {
      noRef++;
      console.log(`  SEM REFERÊNCIA no backup: ${rec.id} (status='${rec.status}', date=${rec.date})`);
      continue;
    }
    await conn.query(`UPDATE "Attendances" SET "status"=$1, "updatedAt"=now() WHERE "id"=$2`, {
      bind: [correct, rec.id]
    });
    fixed++;
    if (fixed <= 5 || fixed % 1000 === 0) {
      console.log(`  Corrigido ${rec.id}: '${rec.status}' -> '${correct}'`);
    }
  }

  // 5) Relatório final
  console.log('\n=== RESULTADO ===');
  console.log(`  Corrigidos: ${fixed}`);
  console.log(`  Sem referência no backup (ficaram como estavam): ${noRef}`);

  const check = await conn.query(
    `SELECT status, COUNT(*) as n FROM "Attendances" GROUP BY status`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log('\n  Status na produção agora:');
  check.forEach(r => console.log(`    '${r.status}' -> ${r.n}`));

  await conn.close();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
