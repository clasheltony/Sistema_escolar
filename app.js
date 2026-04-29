require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, Teacher } = require('./models');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const activityRoutes = require('./routes/activities');
const reportRoutes = require('./routes/reports');

const app = express();

// Configurações
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'escola_secreta',
  resave: false,
  saveUninitialized: false
}));

// Rotas
app.use('/', routes);

// Sincronizar Banco e Iniciar Servidor
const PORT = process.env.PORT || 3000;

sequelize.sync({ force: false }).then(async () => {
  console.log('Banco de dados sincronizado');
  
  // Criar professor padrão se não existir
  const defaultEmail = 'admin@escola.com';
  const existingTeacher = await Teacher.findOne({ where: { email: defaultEmail } });
  if (!existingTeacher) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Teacher.create({
      name: 'Professor Admin',
      email: defaultEmail,
      password: hashedPassword
    });
    console.log(`Professor criado: ${defaultEmail} / admin123`);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao conectar com o banco de dados:', err);
});
