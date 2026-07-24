const { Class, Student, Teacher } = require('../models');

exports.getDashboard = async (req, res) => {
  try {
    const isSecretaria = req.session.role === 'secretaria';
    let classes, teachers;

    if (isSecretaria) {
      teachers = await Teacher.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
      classes = await Class.findAll({
        include: [{ model: Teacher, attributes: ['name'] }],
        order: [['createdAt', 'DESC']]
      });
    } else {
      classes = await Class.findAll({ where: { teacherId: req.session.teacherId } });
    }

    res.render('dashboard', {
      teacherName: req.session.teacherName,
      role: req.session.role,
      classes,
      teachers,
      isSecretaria
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar dashboard');
  }
};

exports.createClass = async (req, res) => {
  try {
    const { name, subject } = req.body;
    const teacherId = req.session.role === 'secretaria' ? (req.body.teacherId || req.session.teacherId) : req.session.teacherId;
    await Class.create({ name, subject, teacherId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar turma');
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };
    await Class.destroy({ where });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar turma');
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject } = req.body;
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };
    await Class.update({ name, subject }, { where });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar turma');
  }
};

exports.duplicateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { newSubject } = req.body;
    const teacherId = req.session.role === 'secretaria' ? (req.body.teacherId || req.session.teacherId) : req.session.teacherId;
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };

    const originalClass = await Class.findOne({ where });
    if (!originalClass) return res.status(404).send('Turma não encontrada');

    const newClass = await Class.create({
      name: originalClass.name,
      subject: newSubject,
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
    const where = req.session.role === 'secretaria' ? { id } : { id, teacherId: req.session.teacherId };
    const classInfo = await Class.findOne({ where, include: [{ model: Teacher, attributes: ['name'] }] });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({ 
      where: { classId: id },
      order: [['active', 'DESC'], ['name', 'ASC']]
    });

    const teacherFilter = req.session.role === 'secretaria' ? {} : { teacherId: req.session.teacherId };
    const otherClasses = await Class.findAll({
      where: { ...teacherFilter, id: { [require('sequelize').Op.ne]: id } },
      order: [['name', 'ASC']]
    });

    res.render('class_details', { classInfo, students, otherClasses, teacherName: req.session.teacherName, role: req.session.role });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar detalhes da turma');
  }
};
