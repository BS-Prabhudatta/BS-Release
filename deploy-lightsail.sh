#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process for AWS Lightsail..."

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
sudo mkdir -p /var/www/release.brandsystems.com
sudo chown -R ubuntu:ubuntu /var/www/release.brandsystems.com

# Navigate to application directory
cd /var/www/release.brandsystems.com

# Clone or pull latest code
if [ -d "/var/www/release.brandsystems.com/.git" ]; then
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
sudo cp nginx.conf /etc/nginx/sites-available/release.brandsystems.com
sudo ln -sf /etc/nginx/sites-available/release.brandsystems.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL certificate
echo "Setting up SSL certificate..."
sudo certbot --nginx -d release.brandsystems.com --non-interactive --agree-tos --email your-email@example.com

# Start application with PM2
echo "Starting application with PM2..."
pm2 delete bs-release 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

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
echo "Your application should now be running at https://release.brandsystems.com"
echo ""
echo "Useful commands:"
echo "- View application status: pm2 status"
echo "- View application logs: pm2 logs"
echo "- Monitor resources: pm2 monit"
echo "- View Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "- Restart application: pm2 restart bs-release"
echo "- Restart Nginx: sudo systemctl restart nginx" 