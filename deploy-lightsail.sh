#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process for AWS Lightsail..."

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "Installing required packages..."
sudo apt install -y nginx certbot python3-certbot-nginx

# Install Node.js
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "Setting up application directory..."
sudo mkdir -p /var/www/release.brandsystems.com
sudo chown -R $USER:$USER /var/www/release.brandsystems.com

# Clone or pull latest code
if [ -d "/var/www/release.brandsystems.com/.git" ]; then
    echo "Updating existing repository..."
    cd /var/www/release.brandsystems.com
    git pull
else
    echo "Cloning repository..."
    git clone https://github.com/yourusername/bs-release.git /var/www/release.brandsystems.com
    cd /var/www/release.brandsystems.com
fi

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Build CSS
echo "Building CSS..."
npm run build

# Create required directories
echo "Creating required directories..."
mkdir -p logs
mkdir -p public/uploads

# Set proper permissions
echo "Setting permissions..."
sudo chown -R $USER:$USER .
sudo chmod -R 755 public
sudo chmod -R 755 db
sudo chmod -R 755 logs

# Configure Nginx
echo "Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/release.brandsystems.com
sudo ln -sf /etc/nginx/sites-available/release.brandsystems.com /etc/nginx/sites-enabled/
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
pm2 startup ubuntu
sudo env PATH=$PATH:/usr/bin pm2 startup ubuntu -u $USER --hp /home/$USER

echo "Deployment completed successfully!"
echo "Your application should now be running at https://release.brandsystems.com"
echo ""
echo "You can:"
echo "- Check application status with: pm2 status"
echo "- View logs with: pm2 logs"
echo "- Monitor resources with: pm2 monit" 