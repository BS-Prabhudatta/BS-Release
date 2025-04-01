#!/bin/bash

# Exit on error
set -e

# Configuration
IP_ADDRESS="13.212.229.193"
DOMAIN="release.brandsystems.com"
APP_DIR="/var/www/release.brandsystems.com"

echo "Starting deployment process for AWS Lightsail..."
echo "IP Address: $IP_ADDRESS"
echo "Domain: $DOMAIN"
echo "Application Directory: $APP_DIR"

# Update system
echo "Updating system packages..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

# Install required packages
echo "Installing required packages..."
sudo DEBIAN_FRONTEND=noninteractive apt install -y nginx certbot python3-certbot-nginx build-essential git

# Install Node.js (using Node 18 LTS)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo DEBIAN_FRONTEND=noninteractive apt install -y nodejs

# Verify Node.js and npm installation
echo "Verifying Node.js and npm versions..."
node --version
npm --version

# Install global packages
echo "Installing global packages..."
sudo npm install -g pm2 tailwindcss --no-progress

# Create application directory
echo "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R ubuntu:ubuntu $APP_DIR

# Navigate to application directory
cd $APP_DIR

# Clone or pull latest code
if [ -d "$APP_DIR/.git" ]; then
    echo "Updating existing repository..."
    git pull
else
    echo "Cloning repository..."
    git clone https://github.com/BS-Prabhudatta/BS-Release.git .
fi

# Install production dependencies
echo "Installing production dependencies..."
npm install --production --no-progress

# Ensure public/css directory exists
mkdir -p public/css

# Create a basic Tailwind config if it doesn't exist
if [ ! -f "tailwind.config.js" ]; then
    echo "Creating Tailwind config..."
    cat > tailwind.config.js <<EOL
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOL
fi

# Create input.css if it doesn't exist
if [ ! -f "public/css/input.css" ]; then
    echo "Creating input.css..."
    cat > public/css/input.css <<EOL
@tailwind base;
@tailwind components;
@tailwind utilities;
EOL
fi

# Build CSS using global Tailwind
echo "Building CSS..."
tailwindcss -i ./public/css/input.css -o ./public/css/output.css --minify

# Create required directories
echo "Creating required directories..."
mkdir -p logs
mkdir -p public/uploads
mkdir -p db

# Set proper permissions
echo "Setting permissions..."
sudo chown -R ubuntu:ubuntu .
sudo find . -type d -exec chmod 755 {} \;
sudo find . -type f -exec chmod 644 {} \;
sudo chmod -R 755 public
sudo chmod -R 755 db
sudo chmod -R 755 logs

# Configure Nginx
echo "Configuring Nginx..."
if [ ! -f "nginx.conf" ]; then
    echo "Error: nginx.conf not found in repository"
    exit 1
fi
sudo cp nginx.conf /etc/nginx/sites-available/$DOMAIN
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Ensure environment variables are set
echo "Setting up environment variables..."
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env <<EOL
PORT=3000
NODE_ENV=production
EOL
fi

# Start application with PM2
echo "Starting application with PM2..."
pm2 delete bs-release 2>/dev/null || true
NODE_ENV=production pm2 start server.js --name bs-release
pm2 save

# Verify application is running
echo "Verifying application status..."
pm2 list
curl -I http://localhost:3000 || echo "Warning: Application not responding on port 3000"

# Setup PM2 startup script
echo "Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

# Verify CSS build
echo "Verifying CSS build..."
if [ -f "public/css/output.css" ]; then
    echo "CSS build successful!"
    ls -lh public/css/output.css
else
    echo "Warning: CSS file not found. Build might have failed."
    exit 1
fi

# Display useful information
echo "Deployment completed successfully!"
echo ""
echo "Your application should now be accessible at:"
echo "http://$IP_ADDRESS"
echo "http://$DOMAIN (once DNS is configured)"
echo ""
echo "Useful commands:"
echo "- View application status: pm2 status"
echo "- View application logs: pm2 logs"
echo "- Monitor resources: pm2 monit"
echo "- View Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "- Restart application: pm2 restart bs-release"
echo "- Restart Nginx: sudo systemctl restart nginx"

echo ""
echo "Next steps:"
echo "1. Configure your DNS to point $DOMAIN to $IP_ADDRESS"
echo "2. Once DNS is configured, run: sudo certbot --nginx -d $DOMAIN" 