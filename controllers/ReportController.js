const { Op } = require('sequelize');
const { Class, Student, Attendance, Grade, Bimester } = require('../models');

exports.getReport = async (req, res) => {
  try {
    const classes = await Class.findAll({ where: { teacherId: req.session.teacherId } });
    const bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['id', 'ASC']] });
    
    const classId = req.query.classId || (classes.length > 0 ? classes[0].id : null);
    const selectedBimesterId = req.query.bimesterId || '';

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
      const students = await Student.findAll({ where: { classId } });
      
      for (const student of students) {
        // Fetch attendances with date filter
        const attendances = await Attendance.findAll({ where: { studentId: student.id, ...dateFilter } });
        const totalClasses = attendances.length;
        const presentClasses = attendances.filter(a => a.status === 'Presente').length;
        const attendanceRate = totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(2) : 0;

        // Fetch grades with date filter
        const grades = await Grade.findAll({ where: { studentId: student.id, ...dateFilter } });
        let totalVistos = 0;
        let earnedVistos = 0;

        let sumAVI = 0, countAVI = 0;
        let sumPratica = 0, countPratica = 0;
        let sumParticipacao = 0, countParticipacao = 0;

        grades.forEach(g => {
          if (g.type === 'Nota') {
            if (g.activityName === 'Prova (AVI)') {
              sumAVI += parseFloat(g.value);
              countAVI++;
            } else if (g.activityName === 'Atividade Prática') {
              sumPratica += parseFloat(g.value);
              countPratica++;
            } else if (g.activityName === 'Participação em Aula') {
              sumParticipacao += parseFloat(g.value);
              countParticipacao++;
            }
          } else if (g.type === 'Visto') {
            totalVistos++;
            if (g.status) earnedVistos++;
          }
        });
        
        const notaAVI = countAVI > 0 ? (sumAVI / countAVI) : 0;
        const notaPratica = countPratica > 0 ? (sumPratica / countPratica) : 0;
        const notaParticipacao = countParticipacao > 0 ? (sumParticipacao / countParticipacao) : 0;

        const notaFrequencia = (parseFloat(attendanceRate) / 100) * 10;
        const notaVistos = totalVistos > 0 ? (earnedVistos / totalVistos) * 10 : 0;

        const avaliacaoContinua = (notaFrequencia + notaVistos + notaParticipacao) / 3;
        const mediaBimestral = (notaAVI + notaPratica + avaliacaoContinua) / 3;

        reportData.push({
          student,
          attendanceRate,
          vistoStatus: `${earnedVistos}/${totalVistos}`,
          notaAVI,
          notaPratica,
          avaliacaoContinua,
          mediaBimestral
        });
      }
    }

    res.render('report', { 
      teacherName: req.session.teacherName,
      classes,
      selectedClass,
      reportData,
      bimesters,
      selectedBimesterId
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao gerar relatório');
  }
};
