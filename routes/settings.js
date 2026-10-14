const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/SettingsController');

router.get('/', settingsController.getSettings);
router.post('/bimesters', settingsController.updateBimesters);
router.post('/password', settingsController.updatePassword);

module.exports = router;
