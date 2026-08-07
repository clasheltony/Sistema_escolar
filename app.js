require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, Teacher, Serie, Turma, Class } = require('./models');
const routes = require('./routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'escola_secreta',
  resave: false,
  saveUninitialized: false
}));

app.use('/', routes);

const PORT = process.env.PORT || 3000;

sequelize.sync().then(async () => {
  console.log('Banco de dados sincronizado');

  try {
    await sequelize.query(`ALTER TABLE "Classes" ADD COLUMN "turmaId" TEXT REFERENCES "Turmas"("id");`);
    console.log('Coluna turmaId adicionada');
  } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }

  try {
    await sequelize.query(`ALTER TABLE "Classes" ADD COLUMN "baseTecnica" TEXT;`);
    console.log('Coluna baseTecnica adicionada');
  } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }

  try {
    await sequelize.query(`ALTER TABLE "Turmas" ADD COLUMN "serieId" TEXT REFERENCES "Series"("id");`);
    console.log('Coluna serieId adicionada');
  } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }

  const classCount = await Class.count();
  if (classCount > 0) {
    const turmaCount = await Turma.count();
    if (turmaCount === 0) {
      const classes = await Class.findAll({ group: ['name'], attributes: ['name'] });
      for (const c of classes) {
        if (c.name) {
          const turma = await Turma.create({ name: c.name });
          await Class.update({ turmaId: turma.id }, { where: { name: c.name, turmaId: null } });
        }
      }
      console.log('Turmas migradas dos dados existentes');
    }
  }

  const adminEmail = 'admin@escola.com';
  const existingAdmin = await Teacher.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Teacher.create({
      name: 'Professor Admin',
      email: adminEmail,
      password: hashedPassword
    });
    console.log(`Professor criado: ${adminEmail} / admin123`);
  }

  const secretariaEmail = 'secretaria@escola.com';
  const existingSecretaria = await Teacher.findOne({ where: { email: secretariaEmail } });
  if (!existingSecretaria) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Teacher.create({
      name: 'Secretaria',
      email: secretariaEmail,
      password: hashedPassword,
      role: 'secretaria'
    });
    console.log(`Conta secretaria criada: ${secretariaEmail} / admin123`);
  }

  const tonyEmail = 'tonyferreira13@gmail.com';
  const existingTony = await Teacher.findOne({ where: { email: tonyEmail } });
  if (!existingTony) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Teacher.create({
      name: 'Antonio Ferreira Dantas Neto',
      email: tonyEmail,
      password: hashedPassword
    });
    console.log(`Professor criado: ${tonyEmail} / admin123`);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao conectar com o banco de dados:', err);
});
