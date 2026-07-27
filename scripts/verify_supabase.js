require('dotenv').config();
const { Sequelize } = require('sequelize');

(async () => {
  const conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await conn.authenticate();

  const [teacher] = await conn.query(
    'SELECT id, email, name FROM "Teacher" WHERE email = ?',
    { replacements: ['tonyferreira13@gmail.com'], type: Sequelize.QueryTypes.SELECT }
  );

  if (teacher) {
    console.log('Usuario encontrado no Supabase:');
    console.log('  Nome:', teacher.name);
    console.log('  Email:', teacher.email);
    console.log('  ID:', teacher.id);
  } else {
    // Try "Teachers" (plural)
    const [teacher2] = await conn.query(
      'SELECT id, email, name FROM "Teachers" WHERE email = ?',
      { replacements: ['tonyferreira13@gmail.com'], type: Sequelize.QueryTypes.SELECT }
    );
    if (teacher2) {
      console.log('Usuario encontrado na tabela "Teachers" (plural):');
      console.log('  Nome:', teacher2.name);
      console.log('  Email:', teacher2.email);
    } else {
      console.log('Usuario NAO encontrado em nenhuma tabela');
    }
  }

  await conn.close();
})();
