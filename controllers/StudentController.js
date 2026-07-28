const { Student, Attendance, Grade, Class, sequelize } = require('../models');

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
    const { name, enrollment, active } = req.body;
    const isActive = active === 'on' || active === true || active === 'true';
    await Student.update({ name, enrollment, active: isActive }, { where: { id: studentId, classId } });
    res.redirect(`/classes/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar aluno');
  }
};

exports.transferStudent = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const { targetClassId } = req.body;

    if (!targetClassId || targetClassId === classId) {
      return res.redirect(`/classes/${classId}`);
    }

    const targetClass = await Class.findByPk(targetClassId);
    if (!targetClass) {
      return res.status(404).send('Turma de destino não encontrada');
    }

    const student = await Student.findOne({ where: { id: studentId, classId } });
    if (!student) {
      return res.status(404).send('Aluno não encontrado');
    }

    await sequelize.transaction(async (t) => {
      await Student.update({ classId: targetClassId }, { where: { id: studentId }, transaction: t });
      await Attendance.update({ classId: targetClassId }, { where: { studentId }, transaction: t });
      await Grade.update({ classId: targetClassId }, { where: { studentId }, transaction: t });
    });

    res.redirect(`/classes/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao transferir aluno');
  }
};
