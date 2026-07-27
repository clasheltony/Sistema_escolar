require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, Teacher } = require('./models');
const routes = require('./routes');

const { sync } = require('./services/syncService');

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

  if (process.env.DATABASE_URL) {
    console.log('Sincronizando com servidor online...');
    sync().then(result => {
      if (result.online) {
        console.log(`[SYNC] Enviados: ${result.pushResult.pushed} | Erros: ${result.pushResult.errors}`);
        console.log(`[SYNC] Recebidos: ${result.pullResult.pulled} | Erros: ${result.pullResult.errors}`);
      } else {
        console.log('[SYNC] Servidor online indisponivel');
      }
    }).catch(err => {
      console.error('[SYNC] Erro na sincronizacao:', err.message);
    });
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao conectar com o banco de dados:', err);
});
