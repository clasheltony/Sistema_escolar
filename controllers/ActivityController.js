const { Class, Student, Attendance, Grade } = require('../models');
const { addToSyncQueue } = require('../services/syncService');

exports.getActivities = async (req, res) => {
  try {
    const { classId } = req.params;
    const classInfo = await Class.findOne({ where: { id: classId, teacherId: req.session.teacherId } });
    if (!classInfo) return res.status(404).send('Turma não encontrada');

    const students = await Student.findAll({ 
      where: { classId },
      order: [['active', 'DESC'], ['name', 'ASC']]
    });

    const attendances = await Attendance.findAll({ where: { classId } });
    const attendanceDates = [...new Set(attendances.map(a => {
      return typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0];
    }))].sort((a, b) => new Date(b) - new Date(a));
    
    const history = {};
    const lessonsPerDate = {};
    const topicsPerDate = {};
    
    attendances.forEach(a => {
      const dateKey = typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0];
      
      if (!history[dateKey]) history[dateKey] = {};
      if (!history[dateKey][a.studentId]) history[dateKey][a.studentId] = {};
      history[dateKey][a.studentId][a.lessonNumber] = a.status;
      
      if (!lessonsPerDate[dateKey] || a.lessonNumber > lessonsPerDate[dateKey]) {
        lessonsPerDate[dateKey] = a.lessonNumber;
      }

      if (a.lessonTopic && !topicsPerDate[dateKey]) {
        topicsPerDate[dateKey] = a.lessonTopic;
      }
    });

    const uniqueGrades = await Grade.findAll({
      attributes: ['activityName', 'type', 'date'],
      where: { classId },
      group: ['activityName', 'type', 'date'],
      order: [['date', 'DESC']]
    });

    const allGrades = await Grade.findAll({
      where: { classId },
      order: [['date', 'DESC'], ['activityName', 'ASC'], ['studentId', 'ASC']]
    });

    res.render('activities', { 
      classInfo, 
      students, 
      teacherName: req.session.teacherName,
      attendanceDates,
      history,
      lessonsPerDate,
      topicsPerDate,
      uniqueGrades: uniqueGrades || [],
      allGrades: allGrades || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar atividades');
  }
};

exports.postAttendance = async (req, res) => {
  try {
    const classId = req.params.classId;
    const { date, lessonCount, lessonTopic, source } = req.body;
    const count = parseInt(lessonCount) || 1;
    const topic = (lessonTopic || '').trim();

    // Queue deletion of old records for this date before bulk delete
    const oldRecords = await Attendance.findAll({ where: { classId, date } });
    for (const record of oldRecords) {
      await addToSyncQueue('Attendance', record.id, 'DELETE', { id: record.id });
    }
    await Attendance.destroy({ where: { classId, date } });

    const keys = Object.keys(req.body);
    for (const key of keys) {
      if (key.startsWith('att_')) {
        const parts = key.split('_');
        const l = parseInt(parts[1]);
        const studentId = parts[2];

        if (l <= count) {
          const status = req.body[key] === 'Ausente' ? 'Ausente' : 'Presente';
          
          await Attendance.create({
            date: date,
            lessonNumber: l,
            status: status,
            lessonTopic: topic || null,
            studentId: studentId,
            classId: classId
          });
        }
      }
    }

    if (source === 'class_details') {
      return res.redirect(`/classes/${classId}`);
    }
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error('postAttendance error:', err);
    res.status(500).send('Erro ao salvar chamada');
  }
};

exports.getAttendanceData = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date) return res.status(400).json({ error: 'Date is required' });

    const attendances = await Attendance.findAll({ where: { classId, date } });

    let lessonCount = 0;
    let lessonTopic = null;
    const data = {};

    attendances.forEach(a => {
      if (a.lessonNumber > lessonCount) lessonCount = a.lessonNumber;
      if (a.lessonTopic && !lessonTopic) lessonTopic = a.lessonTopic;
      if (!data[a.studentId]) data[a.studentId] = {};
      data[a.studentId][a.lessonNumber] = a.status;
    });

    res.json({ date, lessonCount, lessonTopic, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar dados da chamada' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.body;

    const oldRecords = await Attendance.findAll({ where: { classId, date } });
    for (const record of oldRecords) {
      await addToSyncQueue('Attendance', record.id, 'DELETE', { id: record.id });
    }
    await Attendance.destroy({ where: { classId, date } });
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir chamada');
  }
};

exports.postGrade = async (req, res) => {
  try {
    const classId = req.params.classId;
    const { activityName, type, date } = req.body;

    // Queue deletion of old grades for this activity before bulk delete
    const oldGrades = await Grade.findAll({ where: { classId, activityName, type, date } });
    for (const record of oldGrades) {
      await addToSyncQueue('Grade', record.id, 'DELETE', { id: record.id });
    }
    await Grade.destroy({ where: { classId, activityName, type, date } });

    const students = await Student.findAll({ where: { classId } });

    for (const student of students) {
      if (student.active === false) continue;
      
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

    const oldGrades = await Grade.findAll({ where: { classId, activityName, type, date } });
    for (const record of oldGrades) {
      await addToSyncQueue('Grade', record.id, 'DELETE', { id: record.id });
    }
    await Grade.destroy({ where: { classId, activityName, type, date } });
    res.redirect(`/classes/${classId}/activities`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir atividade');
  }
};

exports.updateSingleGrade = async (req, res) => {
  try {
    const { classId, gradeId } = req.params;
    const { value, status } = req.body;

    const grade = await Grade.findOne({ where: { id: gradeId, classId } });
    if (!grade) return res.status(404).send('Registro não encontrado');

    if (grade.type === 'Nota') {
      grade.value = (value !== undefined && value !== '') ? parseFloat(value) : null;
    } else if (grade.type === 'Visto') {
      grade.status = (status === 'on');
    }

    await grade.save();
    res.redirect(`/classes/${classId}/activities#gerenciar`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar lançamento');
  }
};

exports.deleteSingleGrade = async (req, res) => {
  try {
    const { classId, gradeId } = req.params;
    const grade = await Grade.findOne({ where: { id: gradeId, classId } });
    if (grade) {
      await addToSyncQueue('Grade', grade.id, 'DELETE', { id: grade.id });
      await grade.destroy();
    }
    res.redirect(`/classes/${classId}/activities#gerenciar`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir lançamento');
  }
};
