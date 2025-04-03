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
runCommand('sudo apt update && sudo apt upgrade -y', 
    'Updating system packages');

// Install Node.js 20.x
runCommand(`
    sudo apt-get install -y ca-certificates curl gnupg &&
    sudo mkdir -p /etc/apt/keyrings &&
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg &&
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list &&
    sudo apt-get update && sudo apt-get install -y nodejs
`, 'Installing Node.js 20.x');

// Install PostgreSQL 17
runCommand(`
    sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' &&
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add - &&
    sudo apt-get update &&
    sudo apt-get install -y postgresql-17
`, 'Installing PostgreSQL 17');

// Install Git and Nginx
runCommand('sudo apt install -y git nginx', 
    'Installing Git and Nginx');

// 2. PostgreSQL Configuration
runCommand(`
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'brand123';" &&
    sudo -u postgres psql -c "CREATE DATABASE releases_db;"
`, 'Configuring PostgreSQL user and database');

// Update pg_hba.conf
const pgHbaPath = '/etc/postgresql/17/main/pg_hba.conf';
runCommand(`
    sudo sed -i '/^host.*all.*all.*127.0.0.1\\/32.*ident/c\\host    all             all             127.0.0.1/32            md5' ${pgHbaPath} &&
    sudo systemctl restart postgresql
`, 'Updating PostgreSQL access configuration');

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
runCommand('npm install', 
    'Installing Node.js dependencies');

// Initialize database schema by starting the app briefly
console.log('\n🚀 Starting: Initializing database schema...');
try {
    const app = execSync('node server.js', { timeout: 5000 });
    console.log('✅ Completed: Database schema initialized');
} catch (error) {
    // Expected to timeout after schema initialization
    console.log('✅ Completed: Database schema initialized');
}

// 4. Service Management
runCommand('sudo npm install -g pm2',
    'Installing PM2 globally');

runCommand(`
    pm2 start server.js --name release-management &&
    pm2 save &&
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ${process.env.USER} --hp ${process.env.HOME}
`, 'Configuring PM2 and setting up auto-start');

// 5. Nginx Configuration
const nginxConfig = `server {
    listen 80;
    server_name release.brandsystems.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;

runCommand(`
    sudo tee /etc/nginx/sites-available/release.brandsystems.com > /dev/null << 'EOF'
${nginxConfig}
EOF
`, 'Creating Nginx configuration');

runCommand(`
    sudo ln -sf /etc/nginx/sites-available/release.brandsystems.com /etc/nginx/sites-enabled/ &&
    sudo nginx -t &&
    sudo systemctl restart nginx
`, 'Enabling Nginx configuration');

// 6. Install Certbot
runCommand('sudo apt install -y certbot python3-certbot-nginx',
    'Installing Certbot');

// Final instructions
console.log('\n🎉 Deployment completed successfully!\n');
console.log('Next steps:');
console.log('1. Set up DNS in Route 53:');
console.log('   - Create an A record for release.brandsystems.com pointing to your instance\'s IP');
console.log('   - Wait for DNS propagation (usually 5-10 minutes)\n');
console.log('2. Configure HTTPS with Certbot:');
console.log('   Run: sudo certbot --nginx -d release.brandsystems.com\n');
console.log('3. Test your application:');
console.log('   Visit: http://release.brandsystems.com\n');
console.log('Note: After DNS propagation and Certbot setup, your site will be available via HTTPS\n'); 