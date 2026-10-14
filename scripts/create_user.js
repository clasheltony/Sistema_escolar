const bcrypt = require('bcrypt');
const { sequelize, Teacher } = require('../models');

const [name, email, password, role = 'professor'] = process.argv.slice(2);

async function main() {
  if (!name || !email || !password) {
    console.error('Uso: node scripts/create_user.js "<nome>" "<email>" "<senha>" [professor|secretaria]');
    process.exit(1);
  }
  if (!['professor', 'secretaria'].includes(role)) {
    console.error('Papel inválido. Use "professor" ou "secretaria".');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await Teacher.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    console.error('Já existe um usuário com este e-mail.');
    process.exit(1);
  }

  await Teacher.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 10),
    role
  });

  console.log(`Usuário criado: ${normalizedEmail} (papel: ${role})`);
}

main()
  .catch(err => {
    console.error('Erro ao criar usuário:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
