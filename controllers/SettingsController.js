const { Bimester, Teacher } = require('../models');

exports.getSettings = async (req, res) => {
  try {
    const isSecretaria = req.session.role === 'secretaria';
    const teacherFilter = isSecretaria ? {} : { teacherId: req.session.teacherId };
    const teachers = isSecretaria ? await Teacher.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }) : [];

    const selectedTeacherId = req.query.teacherId || null;
    let bimesters;
    if (isSecretaria && selectedTeacherId) {
      bimesters = await Bimester.findAll({ where: { teacherId: selectedTeacherId }, order: [['createdAt', 'ASC']] });
      if (bimesters.length === 0) {
        await Bimester.bulkCreate([
          { name: '1º Bimestre', teacherId: selectedTeacherId },
          { name: '2º Bimestre', teacherId: selectedTeacherId },
          { name: '3º Bimestre', teacherId: selectedTeacherId },
          { name: '4º Bimestre', teacherId: selectedTeacherId }
        ]);
        bimesters = await Bimester.findAll({ where: { teacherId: selectedTeacherId }, order: [['createdAt', 'ASC']] });
      }
    } else {
      bimesters = await Bimester.findAll({ where: teacherFilter, order: [['createdAt', 'ASC']] });
      if (bimesters.length === 0 && !isSecretaria) {
        await Bimester.bulkCreate([
          { name: '1º Bimestre', teacherId: req.session.teacherId },
          { name: '2º Bimestre', teacherId: req.session.teacherId },
          { name: '3º Bimestre', teacherId: req.session.teacherId },
          { name: '4º Bimestre', teacherId: req.session.teacherId }
        ]);
        bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['createdAt', 'ASC']] });
      }
    }

    res.render('settings', { teacherName: req.session.teacherName, bimesters, teachers, selectedTeacherId, isSecretaria });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar configurações');
  }
};

exports.updateBimesters = async (req, res) => {
  try {
    const { bimesterIds, startDates, endDates, teacherId } = req.body;
    const isSecretaria = req.session.role === 'secretaria';

    for (let i = 0; i < bimesterIds.length; i++) {
      const where = isSecretaria ? { id: bimesterIds[i] } : { id: bimesterIds[i], teacherId: req.session.teacherId };
      await Bimester.update({
        startDate: startDates[i] || null,
        endDate: endDates[i] || null
      }, { where });
    }

    const query = isSecretaria && teacherId ? `?teacherId=${teacherId}` : '';
    res.redirect(`/settings${query}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao salvar configurações de bimestres');
  }
};
