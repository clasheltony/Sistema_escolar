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
  console.log('Conectado ao Supabase');

  const hash = bcrypt.hashSync('LET013509ici@', 10);
  const [results] = await conn.query(
    'UPDATE "Teacher" SET password = ? WHERE email = ?',
    { replacements: [hash, 'tonyferreira13@gmail.com'], type: Sequelize.QueryTypes.UPDATE }
  );

  console.log('Senha atualizada no Supabase');
  await conn.close();
})();
