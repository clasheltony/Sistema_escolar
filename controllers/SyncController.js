const syncService = require('../services/syncService');

exports.getStatus = async (req, res) => {
  try {
    const online = await syncService.checkConnection();
    res.json({ online });
  } catch {
    res.json({ online: false });
  }
};

exports.runSync = async (req, res) => {
  try {
    const result = await syncService.sync();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
