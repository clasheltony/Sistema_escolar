const { Student } = require('../models');

exports.addStudent = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, enrollment } = req.body;
    await Student.create({ name, enrollment, classId });
    res.redirect(`/classes/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao adicionar aluno');
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    await Student.destroy({ where: { id: studentId, classId } });
    res.redirect(`/classes/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar aluno');
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { name, enrollment } = req.body;
    await Student.update({ name, enrollment }, { where: { id: studentId, classId } });
    res.redirect(`/classes/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar aluno');
  }
};
