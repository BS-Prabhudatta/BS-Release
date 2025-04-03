# Express Tailwind Release Management Application

A modern web application for managing product releases and their features, built with Express.js and Tailwind CSS. The application provides both public and admin interfaces for managing releases, with rich text editing capabilities and secure authentication.

## Features

- 🔒 Secure Admin Dashboard
- 📝 Rich Text Editor for Feature Content
- 🖼️ Image Upload Support
- 📱 Responsive Design
- 🔐 CSRF Protection
- 🚫 Rate Limiting
- 🧹 XSS Prevention
- 📄 Content Sanitization

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- Git
- PM2 (for production deployment)

## Installation

1. Clone the repository:
```bash
# Linux/Mac
git clone <repository-url>
cd BS-Release

# Windows
git clone <repository-url>
cd BS-Release
```

2. Install dependencies:
```bash
npm install
```

3. Build CSS:
```bash
npm run build
```

4. Create necessary directories:
```bash
# Linux/Mac
mkdir -p public/uploads

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path public/uploads

# Windows (CMD)
mkdir "public\uploads"
```

5. Set up environment configuration:

Option A - Using the example file:
```bash
# Linux/Mac
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env

# Windows (CMD)
copy .env.example .env
```

Option B - Create new .env file:
If the .env.example file is missing, create a new .env file with the following content:
```env
# Application Environment
NODE_ENV=development

# Server Configuration
PORT=3000

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password

# Security
SESSION_SECRET=change-this-to-a-secure-random-string

# File Upload Configuration
UPLOAD_DIR=public/uploads

# Rate Limiting
LOGIN_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
API_RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
API_RATE_LIMIT_MAX_REQUESTS=100

# Cookie Settings
COOKIE_SECURE=false                 # Set to true in production
COOKIE_MAX_AGE=86400000            # 24 hours in milliseconds
```

⚠️ Important Security Notes:
- Change all default passwords and secrets before deploying
- In production, set `NODE_ENV=production` and `COOKIE_SECURE=true`
- Use strong, unique values for `SESSION_SECRET`
- Store sensitive credentials securely
- Never commit the `.env` file to version control

6. Update the `.env` file with your configuration:
```env
NODE_ENV=development
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret
UPLOAD_DIR=public/uploads    # Linux/Mac: public/uploads, Windows: public\uploads
```

## Running Locally

1. Start the development server:
```bash
# Using npm script
npm run dev

# Direct node command (alternative)
node app.js
```

2. Access the application:
- Public interface: `http://localhost:3000`
- Admin interface: `http://localhost:3000/admin/login`

## Project Structure

```
BS-Release/
├── public/              # Static files
│   └── uploads/         # Uploaded images
├── routes/              # Route handlers
│   ├── admin.js        # Admin routes
│   └── index.js        # Public routes
├── views/              # EJS templates
│   ├── admin/          # Admin views
│   └── releases.ejs    # Public views
├── middleware/         # Custom middleware
├── package.json        # Project dependencies
└── README.md          # Project documentation
```

## Security Features

- **Authentication**: Secure admin login with rate limiting
- **CSRF Protection**: All forms and API endpoints are protected
- **XSS Prevention**: Content sanitization using DOMPurify
- **Rate Limiting**: Prevents brute force attacks
- **Secure Cookies**: HTTP-only cookies with secure flags
- **Input Validation**: Comprehensive validation for all inputs
- **File Upload Security**: Type checking and size limits

## API Endpoints

### Admin API

- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/releases/:product` - Product releases management
- `GET /admin/release/:product/:version` - Specific release management
- `POST /admin/api/upload-image` - Image upload for rich text editor

### Feature Management

- `GET /api/features/:id` - Get feature details
- `POST /api/features` - Create new feature
- `PUT /api/features/:id` - Update feature
- `DELETE /api/features/:id` - Delete feature

## Deployment

### Prerequisites
- Node.js hosting environment
- SSL certificate for production
- Adequate storage for uploads

### Deployment Steps

1. Set up your production environment:
```bash
npm install --production
```

2. Configure environment variables:
```env
NODE_ENV=production
PORT=80
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-long-random-string
```

3. Set up a process manager:

For Linux/Mac (PM2):
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start app.js --name "release-manager"

# Enable startup script
pm2 startup
pm2 save
```

For Windows:
```powershell
# Using Windows Service (node-windows)
npm install -g node-windows

# Create Windows Service
node install-service.js
```

4. Configure web server:

For Linux (Nginx):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

For Windows (IIS):
```xml
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxyInboundRule1" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
```

5. Set up SSL:

For Linux (Let's Encrypt):
```bash
sudo certbot --nginx -d your-domain.com
```

For Windows (IIS):
- Use Windows Server Certificate Manager
- Or obtain certificate from trusted provider
- Install certificate through IIS Manager

### Production Considerations

- Enable compression (gzip/deflate)
- Set up proper logging
  ```bash
  # Linux
  pm2 logs

  # Windows
  Get-EventLog -LogName Application | Where-Source -eq "release-manager"
  ```
- Configure backup for uploads
  ```bash
  # Linux
  rsync -av public/uploads/ /backup/uploads/

  # Windows
  robocopy "public\uploads" "D:\backup\uploads" /MIR
  ```
- Set up monitoring
- Configure proper cache headers

## Development

### Adding New Features

1. Create route in appropriate route file
2. Add controller logic
3. Create view template
4. Add necessary frontend JavaScript
5. Update documentation

### Code Style

- Use ESLint for JavaScript
- Follow Tailwind CSS best practices
- Maintain consistent naming conventions
- Document complex functions

## Troubleshooting

Common issues and solutions:

1. **Upload Issues**
   - Check directory permissions:
     ```bash
     # Linux
     chmod 755 public/uploads
     
     # Windows (PowerShell)
     icacls "public\uploads" /grant "Everyone:(OI)(CI)F"
     ```
   - Verify file size limits
   - Ensure proper MIME types

2. **Authentication Issues**
   - Clear cookies
   - Check environment variables:
     ```bash
     # Linux
     printenv | grep ADMIN
     
     # Windows (PowerShell)
     Get-ChildItem Env: | Where-Object { $_.Name -like "*ADMIN*" }
     ```
   - Verify rate limits

3. **Path Issues**
   - Use path.join for file paths:
     ```javascript
     const path = require('path');
     const uploadPath = path.join('public', 'uploads');
     ```
   - Use forward slashes in code
   - Handle both path separators

4. **Process Management**
   - Linux: Check PM2 status
     ```bash
     pm2 status
     pm2 logs
     ```
   - Windows: Check Services
     ```powershell
     Get-Service "release-manager"
     ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the repository or contact the maintainers.

## Authors

- Initial work - [Your Name]

## Acknowledgments

- Express.js team
- Tailwind CSS team
- Quill.js contributors 

## PM2 Commands

- Start application: `npm run pm2:start`
- Stop application: `npm run pm2:stop`
- Restart application: `npm run pm2:restart`
- View logs: `npm run pm2:logs`
- Check status: `npm run pm2:status`

## Directory Structure

```
bs-release/
├── db/                 # Database configuration
│   ├── config.js      # Database configuration
│   └── init.js        # Database initialization
├── logs/              # Application logs
├── public/            # Static files
├── routes/            # Route handlers
├── views/             # EJS templates
├── server.js          # Main application file
├── ecosystem.config.js # PM2 configuration
└── deploy.sh          # Deployment script
```

## Environment Variables

- `NODE_ENV`: Application environment (development/production)
- `PORT`: Application port (default: 3000)
- `SESSION_SECRET`: Session secret key
- `DB_PATH`: Path to SQLite database file
- `PGDATABASE`: PostgreSQL database name (default: releases_db)
- `PGUSER`: PostgreSQL username
- `PGPASSWORD`: PostgreSQL password
- `PGHOST`: PostgreSQL host (default: localhost)
- `PGPORT`: PostgreSQL port (default: 5432)

## Security Considerations

1. Always use HTTPS in production
2. Set a secure SESSION_SECRET
3. Configure proper file permissions
4. Use environment variables for sensitive data
5. Keep dependencies updated

## Maintenance

1. Regular database backups
2. Monitor application logs
3. Update dependencies regularly
4. Check PM2 status and logs

## Troubleshooting

1. Check logs: `pm2 logs`
2. Verify database permissions
3. Check environment variables
4. Restart application if needed: `pm2 restart bs-release` 