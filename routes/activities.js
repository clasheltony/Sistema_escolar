const express = require('express');
const router = express.Router({ mergeParams: true });
const activityController = require('../controllers/ActivityController');

router.get('/', activityController.getActivities);
router.post('/attendance', activityController.postAttendance);
router.post('/attendance/delete', activityController.deleteAttendance);
router.post('/grade', activityController.postGrade);
router.post('/grade/delete', activityController.deleteGrade);

module.exports = router;
