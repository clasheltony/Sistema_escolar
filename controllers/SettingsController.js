const { Bimester } = require('../models');

exports.getSettings = async (req, res) => {
  try {
    let bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['id', 'ASC']] });
    
    // Create default 4 bimesters if they don't exist
    if (bimesters.length === 0) {
      await Bimester.bulkCreate([
        { name: '1º Bimestre', teacherId: req.session.teacherId },
        { name: '2º Bimestre', teacherId: req.session.teacherId },
        { name: '3º Bimestre', teacherId: req.session.teacherId },
        { name: '4º Bimestre', teacherId: req.session.teacherId }
      ]);
      bimesters = await Bimester.findAll({ where: { teacherId: req.session.teacherId }, order: [['id', 'ASC']] });
    }

    res.render('settings', { teacherName: req.session.teacherName, bimesters });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar configurações');
  }
};

exports.updateBimesters = async (req, res) => {
  try {
    const { bimesterIds, startDates, endDates } = req.body;
    
    for (let i = 0; i < bimesterIds.length; i++) {
      await Bimester.update({
        startDate: startDates[i] || null,
        endDate: endDates[i] || null
      }, {
        where: { id: bimesterIds[i], teacherId: req.session.teacherId }
      });
    }

    res.redirect('/settings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao salvar configurações de bimestres');
  }
};
