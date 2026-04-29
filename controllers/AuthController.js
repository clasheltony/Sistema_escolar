const bcrypt = require('bcrypt');
const { Teacher } = require('../models');

exports.getLogin = (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  res.render('login', { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log(`Tentativa de login para: ${email}`);
    const teacher = await Teacher.findOne({ where: { email } });
    if (!teacher) {
      console.log(`Usuário não encontrado: ${email}`);
      return res.render('login', { error: 'E-mail ou senha incorretos' });
    }
    
    const match = await bcrypt.compare(password, teacher.password);
    if (!match) {
      console.log(`Senha incorreta para: ${email}`);
      return res.render('login', { error: 'E-mail ou senha incorretos' });
    }

    console.log(`Login bem-sucedido: ${email}`);
    req.session.teacherId = teacher.id;
    req.session.teacherName = teacher.name;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro no Login:', error);
    res.render('login', { error: 'Erro interno no servidor' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};

exports.getRegister = (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  res.render('register', { error: null });
};

exports.postRegister = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  try {
    console.log(`Tentativa de registro: ${email}`);
    if (password !== confirmPassword) {
      return res.render('register', { error: 'As senhas não coincidem' });
    }

    const existingTeacher = await Teacher.findOne({ where: { email } });
    if (existingTeacher) {
      console.log(`Email já em uso: ${email}`);
      return res.render('register', { error: 'Este e-mail já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({
      name,
      email,
      password: hashedPassword
    });

    console.log(`Usuário criado com sucesso: ${email}`);
    req.session.teacherId = teacher.id;
    req.session.teacherName = teacher.name;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro no Registro:', error);
    res.render('register', { error: 'Erro interno no servidor' });
  }
};
