const express = require('express');
const router = express.Router();
const reportController = require('../controllers/ReportController');

router.get('/report', reportController.getReport);
router.get('/reports/recuperacao', reportController.getRecuperacaoReport);

module.exports = router;
