const { Class, Student } = require('../models');

exports.getDashboard = async (req, res) => {
  try {
    const classes = await Class.findAll({ where: { teacherId: req.session.teacherId } });
    res.render('dashboard', { teacherName: req.session.teacherName, classes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar dashboard');
  }
};

exports.createClass = async (req, res) => {
  try {
    const { name, subject } = req.body;
    await Class.create({ name, subject, teacherId: req.session.teacherId });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar turma');
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    await Class.destroy({ where: { id, teacherId: req.session.teacherId } });
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
    await Class.update({ name, subject }, { where: { id, teacherId: req.session.teacherId } });
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
    
    // Find original class
    const originalClass = await Class.findOne({ where: { id, teacherId: req.session.teacherId } });
    if (!originalClass) return res.status(404).send('Turma não encontrada');

    // Create new class
    const newClass = await Class.create({
      name: originalClass.name,
      subject: newSubject,
      teacherId: req.session.teacherId
    });

    // Copy all students
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
    const classInfo = await Class.findOne({ where: { id, teacherId: req.session.teacherId } });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({ where: { classId: id } });
    res.render('class_details', { classInfo, students, teacherName: req.session.teacherName });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar detalhes da turma');
  }
};
