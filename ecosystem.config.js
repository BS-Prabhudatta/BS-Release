module.exports = {
  apps: [{
    name: 'bs-release',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key',
      PGDATABASE: process.env.PGDATABASE || 'releases_db',
      PGUSER: process.env.PGUSER,
      PGPASSWORD: process.env.PGPASSWORD,
      PGHOST: process.env.PGHOST || 'localhost',
      PGPORT: process.env.PGPORT || 5432
    }
  }]
}; 