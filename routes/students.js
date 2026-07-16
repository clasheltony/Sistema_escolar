const express = require('express');
const router = express.Router({ mergeParams: true });
const studentController = require('../controllers/StudentController');

router.post('/', studentController.addStudent);
router.post('/:studentId/delete', studentController.deleteStudent);
router.post('/:studentId/edit', studentController.updateStudent);
router.post('/:studentId/transfer', studentController.transferStudent);

module.exports = router;
