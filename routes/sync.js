const express = require('express');
const router = express.Router();
const syncController = require('../controllers/SyncController');

router.get('/sync/status', syncController.getStatus);
router.post('/sync/run', syncController.runSync);

module.exports = router;
