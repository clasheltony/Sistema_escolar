const { Class, Student, Attendance, Grade } = require('../models');

exports.getActivities = async (req, res) => {
  try {
    const { classId } = req.params;
    const classInfo = await Class.findOne({ where: { id: classId, teacherId: req.session.teacherId } });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({ where: { classId } });

    // Fetch attendance history
    const attendances = await Attendance.findAll({ where: { classId } });
    const attendanceDates = [...new Set(attendances.map(a => {
      return typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0];
    }))].sort((a, b) => new Date(b) - new Date(a));
    
    const history = {};
    const lessonsPerDate = {};
    
    attendances.forEach(a => {
      const dateKey = typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0];
      
      if (!history[dateKey]) history[dateKey] = {};
      if (!history[dateKey][a.studentId]) history[dateKey][a.studentId] = {};
      history[dateKey][a.studentId][a.lessonNumber] = a.status;
      
      if (!lessonsPerDate[dateKey] || a.lessonNumber > lessonsPerDate[dateKey]) {
        lessonsPerDate[dateKey] = a.lessonNumber;
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
    const { date, lessonCount } = req.body;
    const count = parseInt(lessonCount) || 1;

    // Delete existing attendance for this date and class before saving new ones (Overwriting)
    await Attendance.destroy({ where: { classId, date } });

    const keys = Object.keys(req.body);
    for (const key of keys) {
      // Look for keys like "att_1_10" (att_lesson_studentId)
      if (key.startsWith('att_')) {
        const parts = key.split('_');
        const l = parseInt(parts[1]);
        const studentId = parseInt(parts[2]);

        // Only save if lesson number is within the selected count
        if (l <= count) {
          const status = req.body[key] === 'Ausente' ? 'Ausente' : 'Presente';
          
          await Attendance.create({
            date: date,
            lessonNumber: l,
            status: status,
            studentId: studentId,
            classId: classId
          });
        }
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
    const { activityName, type, date } = req.body;

    // Delete existing grades for this specific activity, type, and date (Overwriting)
    await Grade.destroy({ where: { classId, activityName, type, date } });

    const students = await Student.findAll({ where: { classId } });

    for (const student of students) {
      const key = `grade_${student.id}`;
      const val = req.body[key];

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
