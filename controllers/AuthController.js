const bcrypt = require('bcrypt');
const { Teacher } = require('../models');

exports.getLogin = (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  res.render('login', { error: null });
};

exports.postLogin = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
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
    req.session.role = teacher.role;
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
