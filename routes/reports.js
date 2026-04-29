const express = require('express');
const router = express.Router();
const reportController = require('../controllers/ReportController');

router.get('/report', reportController.getReport);

module.exports = router;
