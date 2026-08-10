require('dotenv').config();
const { Bimester, sequelize } = require('../models');

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL não definido.'); process.exit(1); }

  await sequelize.authenticate();
  console.log('Conectado ao banco de produção.\n');

  const bimesters = await Bimester.findAll({ order: [['name', 'ASC']] });
  console.log(`Total de bimestres no banco: ${bimesters.length}\n`);

  const groups = {};
  bimesters.forEach(b => {
    const key = `${b.teacherId}::${b.name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  });

  let toDelete = [];
  for (const [key, recs] of Object.entries(groups)) {
    if (recs.length <= 1) continue;
    const [teacherId, name] = key.split('::');

    const withDates = recs.find(r => r.startDate && r.endDate);
    const keep = withDates || recs.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
    const extras = recs.filter(r => r.id !== keep.id);

    console.log(`  ${name} | teacher ${teacherId.slice(0, 8)} | ${recs.length} registros -> manter ${keep.id.slice(0, 8)} (${keep.startDate || 'sem data'} -> ${keep.endDate || 'sem data'}) | remover ${extras.length}`);
    toDelete.push(...extras.map(r => r.id));
  }

  console.log(`\nTotal a remover: ${toDelete.length}`);
  if (toDelete.length === 0) {
    console.log('Nenhum duplicado. Nada a fazer.');
    await sequelize.close();
    process.exit(0);
  }

  await Bimester.destroy({ where: { id: toDelete } });
  console.log('Duplicados removidos.');

  const remaining = await Bimester.findAll({ order: [['name', 'ASC']] });
  console.log(`\nBimestres restantes: ${remaining.length}`);
  remaining.forEach(b => console.log(`  ${b.name} | ${b.startDate || 'sem data'} -> ${b.endDate || 'sem data'} | teacher ${b.teacherId.slice(0, 8)}`));

  await sequelize.close();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
