const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const csrf = require('csurf');
const session = require('express-session');

// Import database connection and routes
const { db, initPromise } = require('./db/init');
const routes = require('./routes');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Add CSRF token to all responses
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Mount all routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // If it's an API request, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            error: 'An unexpected error occurred',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    // For web requests, render error page
    res.status(500).render('error', { 
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server after database initialization
const startServer = async () => {
    try {
        await initPromise;
        console.log('Database initialized successfully');
        
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
};

startServer(); 