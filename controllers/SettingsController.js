const { Bimester, Teacher } = require('../models');

exports.getSettings = async (req, res) => {
  try {
    const isSecretaria = req.session.role === 'secretaria';
    const teacherFilter = isSecretaria ? {} : { teacherId: req.session.teacherId };
    const teachers = isSecretaria ? await Teacher.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }) : [];

    const selectedTeacherId = req.query.teacherId || null;
    let bimesters;
    if (isSecretaria && selectedTeacherId) {
      bimesters = await Bimester.findAll({ where: { teacherId: selectedTeacherId }, order: [['name', 'ASC']] });
      if (bimesters.length === 0) {
        await Bimester.bulkCreate([
          { name: '1º Bimestre', startDate: '2026-02-10', endDate: '2026-04-23', teacherId: selectedTeacherId },
          { name: '2º Bimestre', startDate: '2026-04-24', endDate: '2026-07-23', teacherId: selectedTeacherId },
          { name: '3º Bimestre', startDate: '2026-07-24', endDate: '2026-10-05', teacherId: selectedTeacherId },
          { name: '4º Bimestre', startDate: '2026-10-06', endDate: '2026-12-17', teacherId: selectedTeacherId }
        ]);
        bimesters = await Bimester.findAll({ where: { teacherId: selectedTeacherId }, order: [['name', 'ASC']] });
      }
    } else {
      bimesters = await Bimester.findAll({ where: teacherFilter, order: [['name', 'ASC']] });
      if (bimesters.length === 0 && !isSecretaria) {
        await Bimester.bulkCreate([
          { name: '1º Bimestre', startDate: '2026-02-10', endDate: '2026-04-23', teacherId: req.session.teacherId },
          { name: '2º Bimestre', startDate: '2026-04-24', endDate: '2026-07-23', teacherId: req.session.teacherId },
          { name: '3º Bimestre', startDate: '2026-07-24', endDate: '2026-10-05', teacherId: req.session.teacherId },
          { name: '4º Bimestre', startDate: '2026-10-06', endDate: '2026-12-17', teacherId: req.session.teacherId }
        ]);
        bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['name', 'ASC']] });
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
