const { Class, Student, Attendance, Grade } = require('../models');

exports.getActivities = async (req, res) => {
  try {
    const { classId } = req.params;
    const classInfo = await Class.findOne({ where: { id: classId, teacherId: req.session.teacherId } });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({ where: { classId } });

    // Fetch attendance history
    const attendances = await Attendance.findAll({ where: { classId } });
    const attendanceDates = [...new Set(attendances.map(a => a.date))].sort((a, b) => new Date(b) - new Date(a));
    
    const history = {};
    const lessonsPerDate = {};
    
    attendances.forEach(a => {
      if (!history[a.date]) history[a.date] = {};
      if (!history[a.date][a.studentId]) history[a.date][a.studentId] = {};
      history[a.date][a.studentId][a.lessonNumber] = a.status;
      
      if (!lessonsPerDate[a.date] || a.lessonNumber > lessonsPerDate[a.date]) {
        lessonsPerDate[a.date] = a.lessonNumber;
      }
    });

    // Fetch unique grades for management
    const uniqueGrades = await Grade.findAll({
      attributes: ['activityName', 'type', 'date'],
      where: { classId },
      group: ['activityName', 'type', 'date'],
      order: [['date', 'DESC']]
    });

    res.render('activities', { 
      classInfo, 
      students, 
      teacherName: req.session.teacherName,
      attendanceDates,
      history,
      lessonsPerDate,
      uniqueGrades: uniqueGrades || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar atividades');
  }
};

exports.postAttendance = async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const { date, lessonCount, attendance } = req.body;
    const count = parseInt(lessonCount) || 1;

    if (!attendance || typeof attendance !== 'object') {
      return res.status(400).send('Dados de chamada inválidos');
    }

    // Delete existing attendance for this date and class before saving new ones (Overwriting)
    await Attendance.destroy({ where: { classId, date } });

    // Attendance data structure: attendance[lessonNumber][studentId]
    for (let l = 1; l <= count; l++) {
      const lessonData = attendance[l];
      if (!lessonData) continue;

      for (const key in lessonData) {
        const studentId = parseInt(key.replace('sid_', ''));
        if (isNaN(studentId)) continue;

        const status = lessonData[key];

        await Attendance.create({
          date,
          lessonNumber: l,
          status: status,
          studentId: studentId,
          classId: classId
        });
      }
    }

    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error('postAttendance error:', err);
    res.status(500).send('Erro ao salvar chamada');
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.body;
    await Attendance.destroy({ where: { classId, date } });
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir chamada');
  }
};

exports.postGrade = async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const { activityName, type, date, grades } = req.body;

    // Delete existing grades for this specific activity, type, and date (Overwriting)
    await Grade.destroy({ where: { classId, activityName, type, date } });

    const students = await Student.findAll({ where: { classId } });

    for (const student of students) {
      const key = `sid_${student.id}`;
      const val = grades && grades[key] ? grades[key] : null;

      if (type === 'Nota') {
        if (val !== null && val !== '') {
          await Grade.create({
            activityName,
            type,
            date,
            value: parseFloat(val),
            status: null,
            studentId: student.id,
            classId: classId
          });
        }
      } else if (type === 'Visto') {
        await Grade.create({
          activityName,
          type,
          date,
          value: null,
          status: val === 'on' ? true : false,
          studentId: student.id,
          classId: classId
        });
      }
    }
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error('postGrade error:', err);
    res.status(500).send('Erro ao salvar notas/vistos');
  }
};

exports.deleteGrade = async (req, res) => {
  try {
    const { classId } = req.params;
    const { activityName, type, date } = req.body;
    await Grade.destroy({ where: { classId, activityName, type, date } });
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir atividade');
  }
};
