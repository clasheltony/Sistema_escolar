const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');

// Login / logout
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.logout);

// Cadastro público com confirmação de e-mail
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/verify-email/:token', authController.verifyEmail);

// Esqueci a senha / redefinição por e-mail
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password/:token', authController.getResetPassword);
router.post('/reset-password/:token', authController.postResetPassword);

module.exports = router;
