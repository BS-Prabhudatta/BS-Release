#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Utility function to run commands with logging
function runCommand(command, description) {
    console.log(`\n🚀 Starting: ${description}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ Completed: ${description}`);
    } catch (error) {
        console.error(`❌ Error during: ${description}`);
        console.error(error.message);
        process.exit(1);
    }
}

// Function to create and write files
function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Created file: ${filePath}`);
    } catch (error) {
        console.error(`❌ Error creating file: ${filePath}`);
        console.error(error.message);
        process.exit(1);
    }
}

console.log('\n🌟 Starting deployment of Release Management System...\n');

// 1. System Updates and Package Installation
runCommand('sudo apt update && sudo apt upgrade -y', 'Updating system packages');

// Install Node.js 20.x
runCommand(
    'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs',
    'Installing Node.js 20.x'
);

// Install PostgreSQL 17
runCommand(
    'sudo sh -c \'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list\' && ' +
    'wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add - && ' +
    'sudo apt update && sudo apt install -y postgresql-17',
    'Installing PostgreSQL 17'
);

// Install Git and Nginx
runCommand('sudo apt install -y git nginx', 'Installing Git and Nginx');

// 2. PostgreSQL Configuration
runCommand(
    'echo "ALTER USER postgres WITH PASSWORD \'brand123\';\n' +
    'CREATE DATABASE releases_db;" | sudo -u postgres psql',
    'Configuring PostgreSQL user and database'
);

// Update pg_hba.conf
runCommand(
    'echo "host    all             all             127.0.0.1/32            md5" | sudo tee -a /etc/postgresql/17/main/pg_hba.conf',
    'Updating PostgreSQL access configuration'
);
runCommand('sudo systemctl restart postgresql', 'Restarting PostgreSQL service');

// 3. Application Setup
// Create .env file
const envContent = `PGUSER=postgres
PGHOST=localhost
PGDATABASE=releases_db
PGPASSWORD=brand123
PGPORT=5432
NODE_ENV=production
PORT=3000`;
writeFile('.env', envContent);

// Install dependencies
runCommand('npm install', 'Installing Node.js dependencies');

// Initialize database schema using db/init.js
runCommand('node db/init.js', 'Initializing database schema');

// 4. Service Management
runCommand('sudo npm install -g pm2', 'Installing PM2 globally');
runCommand(
    'sudo pm2 start server.js --name release-management && pm2 save && pm2 startup',
    'Starting app with PM2'
);

// 5. Nginx Configuration
const nginxConfig = `server {
    listen 80;
    server_name release.brandsystems.com 54.169.197.211;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
runCommand(
    `sudo tee /etc/nginx/sites-available/release;brandsystems.com > /dev/null << 'EOF'\n${nginxConfig}\nEOF`,
    'Creating Nginx configuration'
);
runCommand(
    'sudo ln -sf /etc/nginx/sites-available/release.brandsystems.com /etc/nginx/sites-enabled/ && ' +
    'sudo nginx -t && sudo systemctl restart nginx',
    'Enabling Nginx configuration'
);

// 6. Install Certbot
runCommand('sudo apt install -y certbot python3-certbot-nginx', 'Installing Certbot');

// Final instructions
console.log('\n🎉 Deployment completed successfully!\n');
console.log('Next steps:');
console.log('1. Set up DNS in Route 53:');
console.log('   - Create an A record for release.brandsystems.com pointing to 54.169.197.211');
console.log('   - Wait for DNS propagation (usually 5-10 minutes)\n');
console.log('2. Configure HTTPS with Certbot:');
console.log('   Run: sudo certbot --nginx -d release.brandsystems.com\n');
console.log('3. Test your application:');
console.log('   - Via domain: https://release.brandsystems.com');
console.log('   - Via IP: http://54.169.197.211 (HTTPS after Certbot setup)\n');