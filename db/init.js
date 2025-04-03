const { pool, query } = require('./config');

// Initialize database
const initDb = async () => {
    try {
        console.log('Initializing database...');
        
        // Products table
        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Releases table
        await query(`
            CREATE TABLE IF NOT EXISTS releases (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                version TEXT NOT NULL,
                release_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                UNIQUE(product_id, version)
            )
        `);

        // Features table
        await query(`
            CREATE TABLE IF NOT EXISTS features (
                id SERIAL PRIMARY KEY,
                release_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (release_id) REFERENCES releases(id)
            )
        `);

        // Insert sample products if they don't exist
        const products = [
            {
                slug: 'marcom',
                name: 'Marcom',
                description: 'Unified digital platform that streamlines campaign planning, resource management, real-time collaboration, and analytics for enhanced marketing efficiency.'
            },
            {
                slug: 'collaborate',
                name: 'Collaborate',
                description: 'Streamlines the approval and annotation process by enabling real-time collaboration, comprehensive comparison, and efficient change tracking.'
            },
            {
                slug: 'lam',
                name: 'Lam',
                description: 'Localized marketing platform that enables efficient content creation and deployment through template-based systems, advanced targeting, and performance analytics to boost brand consistency and impact.'
            }
        ];

        // Insert products using a single query with ON CONFLICT DO NOTHING
        for (const product of products) {
            await query(
                'INSERT INTO products (slug, name, description) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
                [product.slug, product.name, product.description]
            );
        }

        // Sample releases data
        const releases = [
            // Marcom releases
            {
                product_slug: 'marcom',
                version: '2.1.0',
                release_date: '2024-03-15',
                features: [
                    {
                        title: 'Advanced Analytics Dashboard',
                        content: '<p>New analytics dashboard with customizable widgets and real-time data visualization.</p><ul><li>Custom report builder</li><li>Interactive charts</li><li>Export capabilities</li></ul>'
                    },
                    {
                        title: 'Social Media Integration',
                        content: '<p>Enhanced social media integration with support for multiple platforms.</p><ul><li>Schedule posts across platforms</li><li>Analytics integration</li><li>Content optimization suggestions</li></ul>'
                    }
                ]
            },
            // Add other releases here...
            {
                product_slug: 'collaborate',
                version: '1.0.0',
                release_date: '2024-03-15',
                features: [
                    {
                        title: 'Advanced Analytics Dashboard',
                        content: '<p>New analytics dashboard with customizable widgets and real-time data visualization.</p><ul><li>Custom report builder</li><li>Interactive charts</li><li>Export capabilities</li></ul>'
                    },
                    {
                        title: 'Social Media Integration',
                        content: '<p>Enhanced social media integration with support for multiple platforms.</p><ul><li>Schedule posts across platforms</li><li>Analytics integration</li><li>Content optimization suggestions</li></ul>'
                    }
                ]
            },
            {
                product_slug: 'lam',
                version: '1.0.0',
                release_date: '2024-03-15',
                features: [
                    {
                        title: 'Advanced Analytics Dashboard',
                        content: '<p>New analytics dashboard with customizable widgets and real-time data visualization.</p><ul><li>Custom report builder</li><li>Interactive charts</li><li>Export capabilities</li></ul>'
                    },
                    
                ]
            }   
        ];

        // Insert releases and features using transactions
        for (const release of releases) {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // Get product id
                const productResult = await client.query(
                    'SELECT id FROM products WHERE slug = $1',
                    [release.product_slug]
                );

                if (productResult.rows.length === 0) {
                    console.error(`Product not found: ${release.product_slug}`);
                    await client.query('ROLLBACK');
                    continue;
                }

                const productId = productResult.rows[0].id;

                // Insert release
                const releaseResult = await client.query(
                    'INSERT INTO releases (product_id, version, release_date) VALUES ($1, $2, $3) ON CONFLICT (product_id, version) DO NOTHING RETURNING id',
                    [productId, release.version, release.release_date]
                );

                if (releaseResult.rows.length > 0) {
                    const releaseId = releaseResult.rows[0].id;

                    // Insert features
                    for (const feature of release.features) {
                        await client.query(
                            'INSERT INTO features (release_id, title, content) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                            [releaseId, feature.title, feature.content]
                        );
                    }
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Error processing release ${release.version}:`, err);
            } finally {
                client.release();
            }
        }

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
};

// Initialize the database
const initPromise = initDb().then(async () => {
    await pool.end(); // Close the pool
    console.log('Database connection closed');
    process.exit(0); // Exit successfully
}).catch(async (err) => {
    await pool.end(); // Close the pool on error
    console.error('Initialization failed');
    process.exit(1); // Exit with error
});

// Export the database connection and initialization promise
module.exports = {
    query,
    pool,
    initPromise
}; 