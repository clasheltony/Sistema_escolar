require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, Teacher, Serie, Turma, Class } = require('./models');
const routes = require('./routes');
const flash = require('./middleware/flash');

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
app.use(flash);

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

  // Isolamento por professor: turmas e series passam a ter dono (teacherId).
  try {
    await sequelize.query(`ALTER TABLE "Series" ADD COLUMN "teacherId" UUID REFERENCES "Teachers"("id");`);
    console.log('Coluna teacherId adicionada em Series');
  } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }

  try {
    await sequelize.query(`ALTER TABLE "Turmas" ADD COLUMN "teacherId" UUID REFERENCES "Teachers"("id");`);
    console.log('Coluna teacherId adicionada em Turmas');
  } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }

  // Colunas para confirmacao de e-mail e redefinicao de senha.
  const teacherColumns = [
    [`ALTER TABLE "Teachers" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT TRUE;`, 'Coluna emailVerified adicionada'],
    [`ALTER TABLE "Teachers" ADD COLUMN "emailVerificationToken" TEXT;`, 'Coluna emailVerificationToken adicionada'],
    [`ALTER TABLE "Teachers" ADD COLUMN "emailVerificationExpires" TIMESTAMP WITH TIME ZONE;`, 'Coluna emailVerificationExpires adicionada'],
    [`ALTER TABLE "Teachers" ADD COLUMN "resetPasswordToken" TEXT;`, 'Coluna resetPasswordToken adicionada'],
    [`ALTER TABLE "Teachers" ADD COLUMN "resetPasswordExpires" TIMESTAMP WITH TIME ZONE;`, 'Coluna resetPasswordExpires adicionada']
  ];
  for (const [sql, okMsg] of teacherColumns) {
    try {
      await sequelize.query(sql);
      console.log(okMsg);
    } catch (e) { if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) console.error(e.message); }
  }

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

  // Atribui dono (teacherId) as turmas/series que ainda nao tem, com base nas
  // turmas-com-disciplina (Classes). Ajuda a migrar dados criados antes do
  // isolamento. Idempotente: depois da primeira execucao nao sobra nada sem dono.
  try {
    const semDonoTurmas = await Turma.count({ where: { teacherId: null } });
    const semDonoSeries = await Serie.count({ where: { teacherId: null } });
    if (semDonoTurmas > 0 || semDonoSeries > 0) {
      const classes = await Class.findAll({ attributes: ['turmaId', 'teacherId'] });
      const contagemPorProfessor = {};
      const donosPorTurma = {};
      for (const c of classes) {
        if (!c.teacherId) continue;
        contagemPorProfessor[c.teacherId] = (contagemPorProfessor[c.teacherId] || 0) + 1;
        if (c.turmaId) {
          donosPorTurma[c.turmaId] = donosPorTurma[c.turmaId] || {};
          donosPorTurma[c.turmaId][c.teacherId] = (donosPorTurma[c.turmaId][c.teacherId] || 0) + 1;
        }
      }

      // Professor "principal" = o que possui mais turmas-com-disciplina.
      let principal = null;
      let maior = 0;
      for (const [id, n] of Object.entries(contagemPorProfessor)) {
        if (n > maior) { maior = n; principal = id; }
      }
      if (!principal) {
        const primeiro = await Teacher.findOne({ order: [['createdAt', 'ASC']] });
        principal = primeiro ? primeiro.id : null;
      }

      if (principal) {
        const escolherDono = (mapa) => {
          const ordenado = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
          return ordenado.length ? ordenado[0][0] : principal;
        };

        for (const t of await Turma.findAll({ where: { teacherId: null } })) {
          const dono = donosPorTurma[t.id] ? escolherDono(donosPorTurma[t.id]) : principal;
          await t.update({ teacherId: dono });
        }

        for (const s of await Serie.findAll({ where: { teacherId: null } })) {
          const turmas = await Turma.findAll({ where: { serieId: s.id }, attributes: ['teacherId'] });
          const contagem = {};
          turmas.forEach(t => { if (t.teacherId) contagem[t.teacherId] = (contagem[t.teacherId] || 0) + 1; });
          const dono = Object.keys(contagem).length ? escolherDono(contagem) : principal;
          await s.update({ teacherId: dono });
        }
        console.log(`Turmas e séries antigas atribuídas aos professores (total: ${semDonoTurmas} turmas, ${semDonoSeries} séries)`);
      }
    }
  } catch (e) {
    console.error('Erro ao atribuir dono a turmas/séries:', e.message);
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
