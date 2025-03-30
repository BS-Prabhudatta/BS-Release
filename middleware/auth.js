// Admin credentials (in a real app, these would be stored securely)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'secret123'
};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        // If it's an API request, return 401 JSON response
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Otherwise redirect to login page
        res.redirect('/admin/login');
    }
};

// Login validation
const validateCredentials = (username, password) => {
    return username === 'admin' && password === 'secret123';
};

module.exports = {
    requireAuth,
    validateCredentials
}; 