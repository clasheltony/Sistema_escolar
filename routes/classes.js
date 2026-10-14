const express = require('express');
const router = express.Router();
const classController = require('../controllers/ClassController');
const { requireClassAccess } = require('../middleware/auth');

router.get('/dashboard', classController.getDashboard);
router.post('/classes', classController.createClass);
router.post('/classes/:id/delete', requireClassAccess('id'), classController.deleteClass);
router.post('/classes/:id/edit', requireClassAccess('id'), classController.updateClass);
router.post('/classes/:id/duplicate', requireClassAccess('id'), classController.duplicateClass);
router.get('/classes/:id', requireClassAccess('id'), classController.getClassDetails);
router.post('/turmas', classController.createTurma);
router.post('/turmas/:id/edit', classController.updateTurma);
router.post('/turmas/:id/delete', classController.deleteTurma);
router.post('/series', classController.createSerie);
router.post('/series/:id/delete', classController.deleteSerie);

module.exports = router;
