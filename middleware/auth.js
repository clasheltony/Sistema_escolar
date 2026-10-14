const { Class } = require('../models');

const isSecretaria = (req) => req.session.role === 'secretaria';

const requireAuth = (req, res, next) => {
  if (!req.session.teacherId) {
    return res.redirect('/login');
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session.teacherId) {
    return res.redirect('/login');
  }
  if (!roles.includes(req.session.role)) {
    return res.status(403).send('Acesso negado');
  }
  next();
};

const classScope = (req) => (isSecretaria(req) ? {} : { teacherId: req.session.teacherId });

const requireClassAccess = (param = 'classId') => async (req, res, next) => {
  try {
    const classInfo = await Class.findOne({
      where: { id: req.params[param], ...classScope(req) }
    });
    if (!classInfo) {
      return res.status(404).send('Turma não encontrada');
    }
    req.classInfo = classInfo;
    next();
  } catch (err) {
    console.error('Erro ao verificar acesso à turma:', err);
    res.status(500).send('Erro ao carregar turma');
  }
};

module.exports = { isSecretaria, requireAuth, requireRole, classScope, requireClassAccess };
