const { Op } = require('sequelize');
const { Class, Student, Attendance, Grade, Bimester } = require('../models');

async function calcBimesterData(studentId, startDate, endDate, dateFilter) {
  if (!dateFilter) {
    dateFilter = startDate && endDate
      ? { date: { [Op.between]: [startDate, endDate] } }
      : {};
  }

  const attendances = await Attendance.findAll({ where: { studentId, ...dateFilter } });
  const totalClasses = attendances.length;
  const presentClasses = attendances.filter(a => a.status === 'Presente').length;
  const attendanceRate = totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(2) : 0;

  const grades = await Grade.findAll({ where: { studentId, ...dateFilter } });
  let totalVistos = 0, earnedVistos = 0;
  let sumAVI = 0, countAVI = 0;
  let sumPratica = 0, countPratica = 0;
  let sumParticipacao = 0, countParticipacao = 0;
  let sumRecuperacao = 0, countRecuperacao = 0;

  grades.forEach(g => {
    if (g.type === 'Nota') {
      if (g.activityName === 'Prova (AVI)') {
        sumAVI += parseFloat(g.value); countAVI++;
      } else if (g.activityName === 'Atividade Prática') {
        sumPratica += parseFloat(g.value); countPratica++;
      } else if (g.activityName === 'Participação em Aula') {
        sumParticipacao += parseFloat(g.value); countParticipacao++;
      } else if (g.activityName === 'Recuperação') {
        sumRecuperacao += parseFloat(g.value); countRecuperacao++;
      }
    } else if (g.type === 'Visto') {
      totalVistos++;
      if (g.status) earnedVistos++;
    }
  });

  const notaAVI = Math.round(countAVI > 0 ? (sumAVI / countAVI) : 0);
  const notaPratica = Math.round(countPratica > 0 ? (sumPratica / countPratica) : 0);
  const notaParticipacao = countParticipacao > 0 ? (sumParticipacao / countParticipacao) : 0;
  const notaRecuperacao = countRecuperacao > 0 ? Math.round(sumRecuperacao / countRecuperacao) : null;
  const notaAVIFinal = notaRecuperacao !== null && notaRecuperacao > notaAVI ? notaRecuperacao : notaAVI;

  const notaFrequencia = (parseFloat(attendanceRate) / 100) * 10;
  const notaVistos = totalVistos > 0 ? (earnedVistos / totalVistos) * 10 : 0;
  const avaliacaoContinua = Math.round((notaVistos * 4 + notaParticipacao * 4 + notaFrequencia * 2) / 10);
  const mediaBimestral = Math.round((notaAVIFinal + notaPratica + avaliacaoContinua) / 3);

  return { attendanceRate, vistoStatus: `${earnedVistos}/${totalVistos}`, notaAVI, notaPratica, avaliacaoContinua, notaRecuperacao, notaAVIFinal, mediaBimestral };
}

exports.getReport = async (req, res) => {
  try {
    const classes = await Class.findAll({ where: { teacherId: req.session.teacherId } });
    const bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['id', 'ASC']] });
    
    const classId = req.query.classId || (classes.length > 0 ? classes[0].id : null);
    const selectedBimesterId = req.query.bimesterId || '';
    const selectedSemester = req.query.semester || '';

    let reportData = [];
    let selectedClass = null;

    let dateFilter = {};
    let selectedBimester = null;

    if (selectedBimesterId) {
      selectedBimester = bimesters.find(b => b.id == selectedBimesterId);
      if (selectedBimester && selectedBimester.startDate && selectedBimester.endDate) {
        dateFilter = {
          date: {
            [Op.between]: [selectedBimester.startDate, selectedBimester.endDate]
          }
        };
      }
    }

    if (classId) {
      selectedClass = await Class.findByPk(classId);
      const students = await Student.findAll({ 
        where: { classId },
        order: [['active', 'DESC'], ['name', 'ASC']]
      });

      if (selectedSemester) {
        const semIndex = parseInt(selectedSemester);
        let b1, b2;
        if (semIndex === 1 && bimesters.length >= 2) {
          b1 = bimesters[0]; b2 = bimesters[1];
        } else if (semIndex === 2 && bimesters.length >= 4) {
          b1 = bimesters[2]; b2 = bimesters[3];
        }

        if (b1 && b2 && b1.startDate && b1.endDate && b2.startDate && b2.endDate) {
          for (const student of students) {
            const d1 = await calcBimesterData(student.id, b1.startDate, b1.endDate);
            const d2 = await calcBimesterData(student.id, b2.startDate, b2.endDate);
            const attendanceAvg = ((parseFloat(d1.attendanceRate) + parseFloat(d2.attendanceRate)) / 2).toFixed(2);
            const semesterAverage = Math.round((d1.mediaBimestral + d2.mediaBimestral) / 2);
            reportData.push({ student, b1: d1, b2: d2, attendanceAvg, semesterAverage });
          }
        }
      } else {
        for (const student of students) {
          const d = await calcBimesterData(student.id, null, null, dateFilter);
          reportData.push({ student, ...d });
        }
      }
    }

    res.render('report', { 
      teacherName: req.session.teacherName,
      classes,
      selectedClass,
      reportData,
      bimesters,
      selectedBimesterId,
      selectedSemester
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao gerar relatório');
  }
};

exports.getRecuperacaoReport = async (req, res) => {
  try {
    const classes = await Class.findAll({ where: { teacherId: req.session.teacherId } });
    const bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['id', 'ASC']] });
    
    const selectedBimesterId = req.query.bimesterId || '';
    const selectedSemester = req.query.semester || '';

    let dateFilter = {};

    if (selectedSemester) {
      const semIndex = parseInt(selectedSemester);
      if (semIndex === 1 && bimesters.length >= 2) {
        const b1 = bimesters[0];
        const b2 = bimesters[1];
        if (b1.startDate && b2.endDate) {
          dateFilter = {
            date: {
              [Op.between]: [b1.startDate, b2.endDate]
            }
          };
        }
      } else if (semIndex === 2 && bimesters.length >= 4) {
        const b3 = bimesters[2];
        const b4 = bimesters[3];
        if (b3.startDate && b4.endDate) {
          dateFilter = {
            date: {
              [Op.between]: [b3.startDate, b4.endDate]
            }
          };
        }
      }
    } else if (selectedBimesterId) {
      const selectedBimester = bimesters.find(b => b.id == selectedBimesterId);
      if (selectedBimester && selectedBimester.startDate && selectedBimester.endDate) {
        dateFilter = {
          date: {
            [Op.between]: [selectedBimester.startDate, selectedBimester.endDate]
          }
        };
      }
    }

    let classesReport = [];

    for (const cls of classes) {
      // Buscar todos os alunos da turma de uma vez
      const students = await Student.findAll({ 
        where: { classId: cls.id },
        order: [['active', 'DESC'], ['name', 'ASC']]
      });

      if (students.length === 0) continue;

      const studentIds = students.map(s => s.id);

      const allGrades = await Grade.findAll({
        where: { studentId: { [Op.in]: studentIds }, ...dateFilter }
      });

      const gradesByStudent = {};
      allGrades.forEach(g => {
        if (!gradesByStudent[g.studentId]) gradesByStudent[g.studentId] = [];
        gradesByStudent[g.studentId].push(g);
      });

      let studentsInRecuperacao = [];

      for (const student of students) {
        const grades = gradesByStudent[student.id] || [];

        let sumAVI = 0, countAVI = 0;
        let sumRecuperacao = 0, countRecuperacao = 0;

        grades.forEach(g => {
          if (g.type === 'Nota') {
            if (g.activityName === 'Prova (AVI)') {
              sumAVI += parseFloat(g.value); countAVI++;
            } else if (g.activityName === 'Recuperação') {
              sumRecuperacao += parseFloat(g.value); countRecuperacao++;
            }
          }
        });

        const notaAVI = Math.round(countAVI > 0 ? (sumAVI / countAVI) : 0);

        if ((countAVI > 0 && notaAVI < 6.0) || countRecuperacao > 0) {
          studentsInRecuperacao.push({ student });
        }
      }

      if (studentsInRecuperacao.length > 0) {
        classesReport.push({ classInfo: cls, students: studentsInRecuperacao });
      }
    }

    res.render('recuperacao_report', {
      teacherName: req.session.teacherName,
      classes,
      bimesters,
      selectedBimesterId,
      selectedSemester,
      classesReport
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao gerar relatório de recuperação');
  }
};

