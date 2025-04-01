#!/bin/bash

# Exit on error
set -e

echo "Starting AWS Lightsail deployment process..."

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt install -y nginx
fi

# Install Certbot for SSL
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
fi

# Create application directory if it doesn't exist
APP_DIR="/home/ubuntu/bs-release"
if [ ! -d "$APP_DIR" ]; then
    echo "Creating application directory..."
    mkdir -p $APP_DIR
fi

# Set proper permissions
echo "Setting up permissions..."
sudo chown -R ubuntu:ubuntu $APP_DIR
chmod -R 755 $APP_DIR

# Install dependencies
echo "Installing dependencies..."
cd $APP_DIR
npm install --production

# Build CSS
echo "Building CSS..."
npm run build

# Create logs directory
echo "Setting up logs directory..."
mkdir -p $APP_DIR/logs
chmod 755 $APP_DIR/logs

# Configure Nginx
echo "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/bs-release << EOF
server {
    listen 80;
    server_name _;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads {
        alias $APP_DIR/public/uploads;
    }
}
EOF

# Enable the site
echo "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/bs-release /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx

# Start the application with PM2
echo "Starting application with PM2..."
cd $APP_DIR
pm2 start ecosystem.config.js --env production

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Setup PM2 startup script
echo "Setting up PM2 startup script..."
pm2 startup | grep -v "sudo" | bash

# Setup automatic PM2 startup
echo "Setting up automatic PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "Deployment completed successfully!"
echo "Next steps:"
echo "1. Configure your domain in Nginx configuration"
echo "2. Set up SSL with Certbot: sudo certbot --nginx -d your-domain.com"
echo "3. Check application status: pm2 status"
echo "4. View logs: pm2 logs" 