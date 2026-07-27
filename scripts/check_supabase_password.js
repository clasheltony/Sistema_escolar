require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');

(async () => {
  const conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  await conn.authenticate();
  console.log('Conectado ao Supabase\n');

  // Check Teacher table
  const [teacher] = await conn.query(
    'SELECT id, email, name, password FROM "Teacher" WHERE email = ?',
    { replacements: ['tonyferreira13@gmail.com'], type: Sequelize.QueryTypes.SELECT }
  );

  if (!teacher) {
    console.log('ERRO: Usuário NÃO encontrado na tabela Teacher do Supabase');
    const [all] = await conn.query('SELECT id, email, name FROM "Teacher"', { type: Sequelize.QueryTypes.SELECT });
    console.log('\nTodos os usuários no Supabase:', all);
  } else {
    console.log('Usuário encontrado:');
    console.log('  Nome:', teacher.name);
    console.log('  Email:', teacher.email);
    console.log('  ID:', teacher.id);
    console.log('  Hash da senha:', teacher.password.substring(0, 30) + '...');

    // Test the password
    const testPasswords = ['LET013509ici@', 'let013509ici@'];
    for (const pwd of testPasswords) {
      const match = bcrypt.compareSync(pwd, teacher.password);
      console.log(`  Teste senha "${pwd}": ${match ? 'OK' : 'NÃO CONFERE'}`);
    }
  }

  await conn.close();
})();
