const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { validateCredentials } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Rate limiting for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
});

// Login page
router.get('/login', (req, res) => {
    res.render('admin/login', { 
        title: 'Admin Login',
        error: null,
        csrfToken: req.csrfToken()
    });
});

// Login handler
router.post('/login', loginLimiter, csrfProtection, [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('admin/login', { 
            title: 'Admin Login',
            error: errors.array()[0].msg,
            csrfToken: req.csrfToken()
        });
    }

    const { username, password } = req.body;
    if (validateCredentials(username, password)) {
        req.session.isAuthenticated = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { 
            title: 'Admin Login',
            error: 'Invalid username or password',
            csrfToken: req.csrfToken()
        });
    }
});

// Logout handler
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/admin/login');
    });
});

module.exports = router; 