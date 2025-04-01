const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BS-Release API Documentation',
      version: '1.0.0',
      description: 'API documentation for the BS-Release application',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token for API requests'
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie for authentication'
        }
      }
    },
    security: [
      {
        csrfToken: [],
        sessionAuth: []
      }
    ]
  },
  apis: ['./routes/**/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);
module.exports = specs; 