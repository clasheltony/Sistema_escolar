const bcrypt = require('bcrypt');
const { Teacher } = require('../models');
const { generateToken, hashToken } = require('../utils/tokens');
const { sendMail } = require('../services/mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Monta a URL base do sistema (para os links enviados por e-mail).
// Em producao defina APP_URL (ex.: https://seu-app.onrender.com).
function baseUrl(req) {
  const configured = process.env.APP_URL && process.env.APP_URL.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verificationEmail(name, link) {
  const safeName = escapeHtml(name);
  return {
    subject: 'Confirme seu e-mail - Sistema Gestão Escolar',
    text:
      `Olá, ${name}!\n\n` +
      `Confirme seu e-mail para ativar sua conta:\n${link}\n\n` +
      `O link expira em 24 horas. Se não foi você, ignore este e-mail.`,
    html:
      `<p>Olá, <strong>${safeName}</strong>!</p>` +
      `<p>Confirme seu e-mail para ativar sua conta:</p>` +
      `<p><a href="${link}">Clique aqui para confirmar</a></p>` +
      `<p>Ou copie e cole este endereço no navegador:<br>${link}</p>` +
      `<p>O link expira em 24 horas.</p>`
  };
}

function resetEmail(name, link) {
  const safeName = escapeHtml(name);
  return {
    subject: 'Redefinição de senha - Sistema Gestão Escolar',
    text:
      `Olá, ${name}!\n\n` +
      `Recebemos um pedido para redefinir sua senha. Acesse:\n${link}\n\n` +
      `O link expira em 1 hora. Se não foi você, ignore este e-mail.`,
    html:
      `<p>Olá, <strong>${safeName}</strong>!</p>` +
      `<p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo:</p>` +
      `<p><a href="${link}">Redefinir minha senha</a></p>` +
      `<p>Ou copie e cole este endereço no navegador:<br>${link}</p>` +
      `<p>O link expira em 1 hora. Se não foi você, ignore este e-mail.</p>`
  };
}

const EXT = 24 * 60 * 60 * 1000; // 24h em ms
const ONE_HOUR = 60 * 60 * 1000;

exports.getLogin = (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  res.render('login', { error: null, success: null });
};

exports.postLogin = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
  try {
    const teacher = await Teacher.findOne({ where: { email } });
    if (!teacher) {
      return res.render('login', { error: 'E-mail ou senha incorretos', success: null });
    }

    const match = await bcrypt.compare(password || '', teacher.password);
    if (!match) {
      return res.render('login', { error: 'E-mail ou senha incorretos', success: null });
    }

    if (teacher.emailVerified === false) {
      return res.render('login', {
        error: 'Sua conta ainda não foi confirmada. Verifique seu e-mail (ou cadastre-se de novo para reenviar o link).',
        success: null
      });
    }

    req.session.teacherId = teacher.id;
    req.session.teacherName = teacher.name;
    req.session.role = teacher.role;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro no Login:', error);
    res.render('login', { error: 'Erro interno no servidor', success: null });
  }
};

exports.getRegister = (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  res.render('register', { error: null, success: null });
};

exports.postRegister = async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirmPassword = req.body.confirmPassword || '';

  const render = (error, success) => res.render('register', { error, success });

  try {
    if (!name || !email || !password) {
      return render('Preencha todos os campos.', null);
    }
    if (!EMAIL_RE.test(email)) {
      return render('Informe um e-mail válido.', null);
    }
    if (password.length < 6) {
      return render('A senha deve ter pelo menos 6 caracteres.', null);
    }
    if (password !== confirmPassword) {
      return render('As senhas não conferem.', null);
    }

    const existing = await Teacher.findOne({ where: { email } });
    if (existing) {
      // Se ja existe mas nao foi confirmado, reenvia o link de confirmacao.
      if (existing.emailVerified === false) {
        const token = generateToken();
        existing.emailVerificationToken = hashToken(token);
        existing.emailVerificationExpires = new Date(Date.now() + EXT);
        await existing.save();
        await sendMail({
          to: email,
          ...verificationEmail(existing.name, `${baseUrl(req)}/verify-email/${token}`)
        });
        return render(null, 'Este e-mail já está cadastrado mas ainda não foi confirmado. Enviamos um novo link de confirmação.');
      }
      return render('Este e-mail já está cadastrado.', null);
    }

    const token = generateToken();
    await Teacher.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: 'professor',
      emailVerified: false,
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: new Date(Date.now() + EXT)
    });

    await sendMail({
      to: email,
      ...verificationEmail(name, `${baseUrl(req)}/verify-email/${token}`)
    });

    return render(null, `Cadastro realizado! Enviamos um link de confirmação para ${email}. Confirme para poder entrar.`);
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return render('Erro interno no servidor. Tente novamente.', null);
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const hashed = hashToken(req.params.token);
    const teacher = await Teacher.findOne({ where: { emailVerificationToken: hashed } });

    if (!teacher || !teacher.emailVerificationExpires || teacher.emailVerificationExpires < new Date()) {
      return res.status(400).render('message', {
        ok: false,
        title: 'Link inválido ou expirado',
        message: 'Este link de confirmação não é mais válido. Cadastre-se novamente para receber um novo.',
        link: '/register',
        linkText: 'Ir para o cadastro'
      });
    }

    teacher.emailVerified = true;
    teacher.emailVerificationToken = null;
    teacher.emailVerificationExpires = null;
    await teacher.save();

    return res.render('message', {
      ok: true,
      title: 'E-mail confirmado!',
      message: 'Sua conta foi confirmada com sucesso. Você já pode entrar no sistema.',
      link: '/login',
      linkText: 'Ir para o login'
    });
  } catch (error) {
    console.error('Erro ao confirmar e-mail:', error);
    return res.status(500).render('message', {
      ok: false,
      title: 'Erro',
      message: 'Não foi possível confirmar o e-mail. Tente novamente mais tarde.',
      link: '/login',
      linkText: 'Ir para o login'
    });
  }
};

exports.getForgotPassword = (req, res) => {
  res.render('forgot_password', { error: null, success: null });
};

exports.postForgotPassword = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  // Mensagem generica: nao revela se o e-mail existe ou nao.
  const generic = 'Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.';

  try {
    if (!email || !EMAIL_RE.test(email)) {
      return res.render('forgot_password', { error: 'Informe um e-mail válido.', success: null });
    }

    const teacher = await Teacher.findOne({ where: { email } });
    if (teacher) {
      const token = generateToken();
      teacher.resetPasswordToken = hashToken(token);
      teacher.resetPasswordExpires = new Date(Date.now() + ONE_HOUR);
      await teacher.save();
      await sendMail({
        to: email,
        ...resetEmail(teacher.name, `${baseUrl(req)}/reset-password/${token}`)
      });
    }

    return res.render('forgot_password', { error: null, success: generic });
  } catch (error) {
    console.error('Erro ao solicitar redefinição:', error);
    return res.render('forgot_password', { error: 'Erro interno no servidor. Tente novamente.', success: null });
  }
};

exports.getResetPassword = async (req, res) => {
  try {
    const hashed = hashToken(req.params.token);
    const teacher = await Teacher.findOne({ where: { resetPasswordToken: hashed } });

    if (!teacher || !teacher.resetPasswordExpires || teacher.resetPasswordExpires < new Date()) {
      return res.status(400).render('reset_password', {
        error: 'Link inválido ou expirado. Solicite uma nova redefinição.',
        token: null
      });
    }
    return res.render('reset_password', { error: null, token: req.params.token });
  } catch (error) {
    console.error('Erro ao abrir redefinição:', error);
    return res.status(500).render('reset_password', { error: 'Erro interno no servidor.', token: null });
  }
};

exports.postResetPassword = async (req, res) => {
  const { token } = req.params;
  const password = req.body.password || '';
  const confirmPassword = req.body.confirmPassword || '';

  const render = (error) => res.render('reset_password', { error, token });

  try {
    const hashed = hashToken(token);
    const teacher = await Teacher.findOne({ where: { resetPasswordToken: hashed } });

    if (!teacher || !teacher.resetPasswordExpires || teacher.resetPasswordExpires < new Date()) {
      return res.status(400).render('reset_password', {
        error: 'Link inválido ou expirado. Solicite uma nova redefinição.',
        token: null
      });
    }
    if (password.length < 6) {
      return render('A senha deve ter pelo menos 6 caracteres.');
    }
    if (password !== confirmPassword) {
      return render('As senhas não conferem.');
    }

    teacher.password = await bcrypt.hash(password, 10);
    teacher.resetPasswordToken = null;
    teacher.resetPasswordExpires = null;
    // Quem redefiniu a senha comprovou acesso ao e-mail.
    teacher.emailVerified = true;
    await teacher.save();

    return res.render('login', { error: null, success: 'Senha alterada com sucesso! Entre com a nova senha.' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return render('Erro interno no servidor. Tente novamente.');
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};
