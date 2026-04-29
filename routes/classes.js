const express = require('express');
const router = express.Router();
const classController = require('../controllers/ClassController');

router.get('/dashboard', classController.getDashboard);
router.post('/classes', classController.createClass);
router.post('/classes/:id/delete', classController.deleteClass);
router.post('/classes/:id/edit', classController.updateClass);
router.post('/classes/:id/duplicate', classController.duplicateClass);
router.get('/classes/:id', classController.getClassDetails);

module.exports = router;
