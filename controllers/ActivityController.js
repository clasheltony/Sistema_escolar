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
    const datesSet = new Set();
    attendances.forEach(a => {
      if (!history[a.date]) history[a.date] = {};
      if (!history[a.date][a.studentId]) history[a.date][a.studentId] = {};
      history[a.date][a.studentId][a.lessonNumber] = a.status;
      datesSet.add(a.date);
    });

    res.render('activities', { 
      classInfo, 
      students, 
      teacherName: req.session.teacherName,
      attendanceDates,
      history 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar atividades');
  }
};

exports.postAttendance = async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const { date, attendance1, attendance2 } = req.body;

    if (!attendance1 || typeof attendance1 !== 'object') {
      return res.status(400).send('Dados de chamada inválidos');
    }

    for (const key in attendance1) {
      const studentId = parseInt(key.replace('sid_', ''));
      if (isNaN(studentId)) continue;

      const status1 = attendance1[key];
      const status2 = attendance2 && attendance2[key] ? attendance2[key] : status1; // fallback to status1 if not provided

      // Save lesson 1
      await Attendance.create({
        date,
        lessonNumber: 1,
        status: status1,
        studentId: studentId,
        classId: classId
      });

      // Save lesson 2
      await Attendance.create({
        date,
        lessonNumber: 2,
        status: status2,
        studentId: studentId,
        classId: classId
      });
    }

    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error('postAttendance error:', err);
    res.status(500).send('Erro ao salvar chamada');
  }
};

exports.postGrade = async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const { activityName, type, date, grades } = req.body;

    // Fetch all students to ensure we record missing 'Vistos' (unchecked checkboxes)
    const students = await Student.findAll({ where: { classId } });

    for (const student of students) {
      const key = `sid_${student.id}`;
      // For Notas, if not provided, it might be undefined or empty string.
      // For Vistos, if not provided (unchecked), it will be undefined.
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
        // If type is Visto, we ALWAYS create a record for every student
        // value is 'on' if checked, otherwise null
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
