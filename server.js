const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const csrf = require('csurf');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

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

// Add endpoint to get CSRF token
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Add Swagger UI route before other routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "BS-Release API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        deepLinking: true,
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: 1,
        docExpansion: 'none',
        tryItOutEnabled: true,
        requestSnippetsEnabled: true,
        requestSnippetsGenerators: {
            curl_bash: {
                template: [
                    'curl -X {{method}} "{{url}}"',
                    '  -H "Content-Type: application/json"',
                    '  -H "X-CSRF-Token: {{csrfToken}}"',
                    '  -d \'{{body}}\''
                ].join('\\n'),
                method: 'curl',
                url: '{{url}}',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': '{{csrfToken}}'
                },
                body: '{{body}}'
            }
        }
    }
}));

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
        console.log('Database is ready');
        
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            console.log(`API Documentation available at http://localhost:${port}/api-docs`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
};

startServer(); 