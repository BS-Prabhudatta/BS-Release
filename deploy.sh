#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Build CSS
echo "Building CSS..."
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Set proper permissions
chmod 755 deploy.sh
chmod -R 755 public
chmod -R 755 db

# Start the application with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

echo "Deployment completed successfully!"
echo "You can check the application status with: pm2 status"
echo "View logs with: pm2 logs" 