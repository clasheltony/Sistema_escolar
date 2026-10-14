const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const authRoutes = require('./auth');
const classRoutes = require('./classes');
const studentRoutes = require('./students');
const activityRoutes = require('./activities');
const reportRoutes = require('./reports');
const settingsRoutes = require('./settings');

router.use('/', authRoutes);
router.use('/', requireAuth, classRoutes);
router.use('/classes/:classId/students', requireAuth, studentRoutes);
router.use('/classes/:classId/activities', requireAuth, activityRoutes);
router.use('/', requireAuth, reportRoutes);
router.use('/settings', requireAuth, settingsRoutes);

router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;
