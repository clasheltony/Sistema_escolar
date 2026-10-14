const { Class, Student, Teacher, Turma, Serie, Attendance, Grade } = require('../models');
const { Op } = require('sequelize');
const { classScope } = require('../middleware/auth');

const SUBJECTS = [
  'Português', 'Matemática', 'Química', 'Física', 'História',
  'Geografia', 'Biologia', 'Educação Física', 'Inglês', 'Espanhol',
  'Produção Textual'
];
const BASES_TECNICAS = ['Análises Clínicas', 'Informática'];

exports.getDashboard = async (req, res) => {
  try {
    const isSecretaria = req.session.role === 'secretaria';
    const scope = classScope(req);
    const teachers = isSecretaria
      ? await Teacher.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] })
      : [];
    const series = await Serie.findAll({ where: scope, order: [['name', 'ASC']] });
    const turmas = await Turma.findAll({
      where: scope,
      include: [{ model: Serie, attributes: ['id', 'name', 'color'] }],
      order: [['name', 'ASC']]
    });
    const classes = await Class.findAll({
      where: scope,
      include: [
        { model: Teacher, attributes: ['name'] },
        { model: Turma, attributes: ['id', 'name', 'serieId'] }
      ],
      order: [['name', 'ASC']]
    });

    res.render('dashboard', {
      teacherName: req.session.teacherName,
      role: req.session.role,
      classes,
      teachers,
      series,
      turmas,
      subjects: SUBJECTS,
      basesTecnicas: BASES_TECNICAS,
      isSecretaria
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar dashboard');
  }
};

exports.createClass = async (req, res) => {
  try {
    const { turmaName, subject, baseTecnica } = req.body;
    const teacherId = req.session.role === 'secretaria' ? (req.body.teacherId || null) : req.session.teacherId;
    // A turma pertence ao professor dono da turma-com-disciplina.
    const [turma] = await Turma.findOrCreate({
      where: { name: turmaName, teacherId },
      defaults: { name: turmaName, teacherId }
    });
    await Class.create({ name: turma.name, turmaId: turma.id, subject, baseTecnica: baseTecnica || null, teacherId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar turma');
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    await Grade.destroy({ where: { classId: id } });
    await Attendance.destroy({ where: { classId: id } });
    await Student.destroy({ where: { classId: id } });
    await Class.destroy({ where: { id } });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar turma');
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { turmaName, subject, baseTecnica } = req.body;
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };
    const updateData = { subject: subject || null, baseTecnica: baseTecnica || null };
    const classe = await Class.findOne({ where });
    if (!classe) return res.status(404).send('Turma não encontrada');
    if (turmaName) {
      const [turma] = await Turma.findOrCreate({
        where: { name: turmaName, teacherId: classe.teacherId },
        defaults: { name: turmaName, teacherId: classe.teacherId }
      });
      updateData.name = turma.name;
      updateData.turmaId = turma.id;
    }
    await Class.update(updateData, { where });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar turma');
  }
};

exports.duplicateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { turmaId, subject, baseTecnica } = req.body;
    const teacherId = req.session.role === 'secretaria' ? (req.body.teacherId || null) : req.session.teacherId;
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };

    const originalClass = await Class.findOne({ where });
    if (!originalClass) return res.status(404).send('Turma não encontrada');

    // A turma de destino precisa pertencer ao mesmo professor.
    const turma = await Turma.findOne({ where: { id: turmaId, teacherId } });
    if (!turma) return res.status(400).send('Turma não encontrada');

    const newClass = await Class.create({
      name: turma.name,
      turmaId,
      subject,
      baseTecnica: baseTecnica || null,
      teacherId
    });

    const students = await Student.findAll({ where: { classId: id } });
    for (const student of students) {
      await Student.create({
        name: student.name,
        enrollment: student.enrollment,
        classId: newClass.id
      });
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao duplicar turma');
  }
};

exports.getClassDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const classInfo = await Class.findByPk(id, {
      include: [
        { model: Teacher, attributes: ['name'] },
        { model: Turma, attributes: ['name'] }
      ]
    });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({
      where: { classId: id },
      order: [['active', 'DESC'], ['name', 'ASC']]
    });

    const otherClasses = await Class.findAll({
      where: { id: { [Op.ne]: id }, ...classScope(req) },
      order: [['name', 'ASC']]
    });

    res.render('class_details', { classInfo, students, otherClasses, teacherName: req.session.teacherName, role: req.session.role });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar detalhes da turma');
  }
};

exports.createTurma = async (req, res) => {
  try {
    const { name, serieId } = req.body;
    await Turma.create({ name, serieId: serieId || null, teacherId: req.session.teacherId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar turma');
  }
};

exports.updateTurma = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, serieId } = req.body;
    await Turma.update({ name, serieId: serieId || null }, { where: { id, ...classScope(req) } });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar turma');
  }
};

exports.deleteTurma = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = classScope(req);
    const turma = await Turma.findOne({ where: { id, ...scope } });
    if (!turma) return res.status(404).send('Turma não encontrada');
    await Class.update({ turmaId: null }, { where: { turmaId: id, ...scope } });
    await Turma.destroy({ where: { id, ...scope } });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar turma');
  }
};

exports.createSerie = async (req, res) => {
  try {
    const { name, color } = req.body;
    await Serie.create({ name, color: color || null, teacherId: req.session.teacherId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar série');
  }
};

exports.deleteSerie = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = classScope(req);
    const serie = await Serie.findOne({ where: { id, ...scope } });
    if (!serie) return res.status(404).send('Série não encontrada');
    const turmaCount = await Turma.count({ where: { serieId: id, ...scope } });
    if (turmaCount > 0) {
      return res.status(400).send('Não é possível excluir: existem turmas vinculadas a esta série');
    }
    await Serie.destroy({ where: { id, ...scope } });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar série');
  }
};
