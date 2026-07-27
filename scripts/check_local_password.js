const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');

(async () => {
  const conn = new Sequelize({ dialect: 'sqlite', storage: './database.sqlite', logging: false });
  await conn.authenticate();

  const [teacher] = await conn.query('SELECT id, email, name, password, role FROM Teachers WHERE email = ?', {
    replacements: ['tonyferreira13@gmail.com'],
    type: Sequelize.QueryTypes.SELECT
  });

  if (!teacher) {
    console.log('ERRO: Usuario nao encontrado no SQLite');
  } else {
    console.log('Nome:', teacher.name);
    console.log('Email:', teacher.email);
    console.log('Role:', teacher.role);
    console.log('Hash:', teacher.password.substring(0, 30) + '...');

    const match = bcrypt.compareSync('LET013509ici@', teacher.password);
    console.log('Senha confere:', match ? 'SIM' : 'NAO');
  }

  await conn.close();
})();
