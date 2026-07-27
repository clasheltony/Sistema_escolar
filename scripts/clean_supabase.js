require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');

(async () => {
  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await cloud.authenticate();
  console.log('Conectado ao Supabase\n');

  // 1. See all records
  const all = await cloud.query('SELECT id, email, name, role, "createdAt" FROM "Teacher" ORDER BY email, "createdAt"', {
    type: Sequelize.QueryTypes.SELECT
  });

  console.log('Todos os registros na tabela Teacher:');
  const emailMap = {};
  all.forEach(t => {
    console.log(`  ${t.email} | ${t.id.substring(0,8)}... | ${t.role} | ${t.createdAt}`);
    if (!emailMap[t.email]) emailMap[t.email] = [];
    emailMap[t.email].push(t);
  });

  // 2. Remove duplicates keeping the newest one (or the one that matches local)
  console.log('\nLimpando duplicados...');
  for (const [email, records] of Object.entries(emailMap)) {
    if (records.length > 1) {
      console.log(`\n${email}: ${records.length} registros`);
      // Keep the latest one, delete the rest
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const keep = records[0];
      const deleteIds = records.slice(1).map(r => r.id);
      console.log(`  Mantendo: ${keep.id.substring(0,8)}... (${keep.createdAt})`);
      console.log(`  Removendo: ${deleteIds.map(id => id.substring(0,8)).join(', ')}`);
      
      for (const id of deleteIds) {
        await cloud.query('DELETE FROM "Teacher" WHERE id = ?', { replacements: [id] });
      }
    }
  }

  // 3. Update Tony's role to 'professor' if wrong
  await cloud.query(
    'UPDATE "Teacher" SET role = ? WHERE email = ?',
    { replacements: ['professor', 'tonyferreira13@gmail.com'] }
  );

  // 4. Ensure password is correct
  const hash = bcrypt.hashSync('LET013509ici@', 10);
  await cloud.query(
    'UPDATE "Teacher" SET password = ? WHERE email = ?',
    { replacements: [hash, 'tonyferreira13@gmail.com'] }
  );

  // 5. Drop the old "Teachers" table if it exists
  try {
    await cloud.query('DROP TABLE IF EXISTS "Teachers"');
    console.log('\nTabela "Teachers" (plural) removida');
  } catch(e) {
    console.log('\nErro ao remover tabela Teachers:', e.message);
  }

  // 6. Verify final state
  const final = await cloud.query('SELECT id, email, name, role FROM "Teacher" ORDER BY email', {
    type: Sequelize.QueryTypes.SELECT
  });
  console.log('\nEstado final da tabela Teacher:');
  final.forEach(t => console.log(`  ${t.email} (${t.role})`));

  await cloud.close();
  console.log('\nConcluido!');
})();
