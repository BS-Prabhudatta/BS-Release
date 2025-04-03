const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'releases_db',
    password: process.env.PGPASSWORD || 'brand123',
    port: process.env.PGPORT || 5432,
});

// Helper functions for database operations
const query = (text, params) => pool.query(text, params);

const getClient = async () => {
    const client = await pool.connect();
    const query = (text, params) => client.query(text, params);
    return [client, query];
};

module.exports = {
    pool,
    query,
    getClient
}; 