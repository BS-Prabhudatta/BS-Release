#!/bin/bash

# Exit on error
set -e

echo "Starting AWS Lightsail deployment process for Amazon Linux 2023..."

# Update system
echo "Updating system packages..."
sudo dnf update -y

# Install development tools
echo "Installing development tools..."
sudo dnf groupinstall "Development Tools" -y

# Install Node.js 20 if not already installed
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1)" != "v20" ]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
fi

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo dnf install nginx -y
fi

# Create application directory if it doesn't exist
APP_DIR="/home/ec2-user/BS-Release"
if [ ! -d "$APP_DIR" ]; then
    echo "Creating application directory..."
    mkdir -p $APP_DIR
fi

# Set proper permissions
echo "Setting up permissions..."
sudo chown -R ec2-user:ec2-user $APP_DIR
chmod -R 755 $APP_DIR

# Install dependencies (including dev dependencies for build)
echo "Installing dependencies..."
cd $APP_DIR
npm install --no-audit

# Install Tailwind CSS globally
echo "Installing Tailwind CSS globally..."
sudo npm install -g tailwindcss

# Create Tailwind CSS config if it doesn't exist
if [ ! -f "tailwind.config.js" ]; then
    echo "Initializing Tailwind CSS config..."
    tailwindcss init
fi

# Ensure public/css directory exists
mkdir -p public/css

# Create input.css if it doesn't exist
if [ ! -f "public/css/input.css" ]; then
    echo "Creating default Tailwind CSS input file..."
    cat > public/css/input.css << EOF
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
fi

# Build CSS
echo "Building CSS..."
tailwindcss -i ./public/css/input.css -o ./public/css/output.css

# Create logs directory
echo "Setting up logs directory..."
mkdir -p $APP_DIR/logs
chmod 755 $APP_DIR/logs

# Configure SELinux for Nginx (if enabled)
echo "Configuring SELinux..."
if command -v sestatus &> /dev/null && sestatus | grep -q "SELinux status: *enabled"; then
    sudo setsebool -P httpd_can_network_connect 1
    sudo semanage port -a -t http_port_t -p tcp 3000 || true
fi

# Configure Nginx
echo "Configuring Nginx..."
sudo tee /etc/nginx/conf.d/BS-Release.conf << EOF
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

# Remove default Nginx configuration if it exists
sudo rm -f /etc/nginx/conf.d/default.conf

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Start and enable Nginx service
echo "Starting Nginx service..."
sudo systemctl enable nginx
sudo systemctl start nginx

# Start the application with PM2
echo "Starting application with PM2..."
cd $APP_DIR
pm2 start ecosystem.config.js --env production

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Setup PM2 startup script
echo "Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Setup firewall rules
echo "Configuring firewall..."
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --reload
fi

echo "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your domain in Nginx configuration at /etc/nginx/conf.d/BS-Release.conf"
echo "2. Install and configure SSL certificate"
echo "3. Check application status: pm2 status"
echo "4. View logs: pm2 logs"
echo ""
echo "Common commands:"
echo "- Restart application: pm2 restart BS-Release"
echo "- View logs: pm2 logs"
echo "- Monitor resources: pm2 monit"
echo "- Restart Nginx: sudo systemctl restart nginx"
echo "- View Nginx logs: sudo tail -f /var/log/nginx/error.log" 