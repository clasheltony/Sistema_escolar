const express = require('express');
const router = express.Router();
const classController = require('../controllers/ClassController');

router.get('/dashboard', classController.getDashboard);
router.post('/classes', classController.createClass);
router.post('/classes/:id/delete', classController.deleteClass);
router.post('/classes/:id/edit', classController.updateClass);
router.post('/classes/:id/duplicate', classController.duplicateClass);
router.get('/classes/:id', classController.getClassDetails);
router.post('/turmas', classController.createTurma);
router.post('/turmas/:id/edit', classController.updateTurma);
router.post('/turmas/:id/delete', classController.deleteTurma);
router.post('/series', classController.createSerie);
router.post('/series/:id/delete', classController.deleteSerie);

module.exports = router;
