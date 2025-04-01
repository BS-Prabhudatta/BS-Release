const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const dbPath = path.join(__dirname, 'releases.db');

// Create a new database or open existing
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Promisify db.run and db.get
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Check if database exists
const dbExists = fs.existsSync(dbPath);

// Create tables
const initDb = async () => {
    // Skip initialization if database already exists
    if (dbExists) {
        console.log('Database already exists, skipping initialization');
        return;
    }

    try {
        console.log('Initializing new database...');
        
        // Products table
        await run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Releases table
        await run(`
            CREATE TABLE IF NOT EXISTS releases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                version TEXT NOT NULL,
                release_date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                UNIQUE(product_id, version)
            )
        `);

        // Features table
        await run(`
            CREATE TABLE IF NOT EXISTS features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                release_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (release_id) REFERENCES releases(id)
            )
        `);

        // Insert sample products
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

        // Insert products one by one
        for (const product of products) {
            await run(
                'INSERT OR IGNORE INTO products (slug, name, description) VALUES (?, ?, ?)',
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
            {
                product_slug: 'marcom',
                version: '2.0.0',
                release_date: '2024-02-01',
                features: [
                    {
                        title: 'Complete UI Redesign',
                        content: '<p>Major update to the user interface with modern design principles.</p><ul><li>New component library</li><li>Improved accessibility</li><li>Dark mode support</li></ul>'
                    }
                ]
            },
            // Collaborate releases
            {
                product_slug: 'collaborate',
                version: '1.5.0',
                release_date: '2024-03-10',
                features: [
                    {
                        title: 'Real-time Document Collaboration',
                        content: '<p>Multiple users can now edit documents simultaneously with live updates.</p><ul><li>Conflict resolution</li><li>Change tracking</li><li>Version history</li></ul>'
                    },
                    {
                        title: 'Team Chat Improvements',
                        content: '<p>Enhanced team chat functionality with new features.</p><ul><li>Thread replies</li><li>Rich text formatting</li><li>File sharing improvements</li></ul>'
                    }
                ]
            },
            {
                product_slug: 'collaborate',
                version: '1.4.0',
                release_date: '2024-01-20',
                features: [
                    {
                        title: 'Project Templates',
                        content: '<p>Introduce project templates for quick setup of common project types.</p><ul><li>Custom template builder</li><li>Template sharing</li><li>Import/Export functionality</li></ul>'
                    }
                ]
            },
            // Lam releases
            {
                product_slug: 'lam',
                version: '3.2.0',
                release_date: '2024-03-20',
                features: [
                    {
                        title: 'Interactive Assessment Builder',
                        content: '<p>New assessment creation tool with interactive question types.</p><ul><li>Drag-and-drop interface</li><li>Multiple question types</li><li>Advanced scoring options</li></ul>'
                    },
                    {
                        title: 'Learning Path Creator',
                        content: '<p>Create custom learning paths with conditional progression.</p><ul><li>Visual path builder</li><li>Prerequisites management</li><li>Progress tracking</li></ul>'
                    }
                ]
            },
            {
                product_slug: 'lam',
                version: '3.1.0',
                release_date: '2024-02-15',
                features: [
                    {
                        title: 'Mobile Learning Support',
                        content: '<p>Enhanced mobile support for learning materials and assessments.</p><ul><li>Responsive design</li><li>Offline access</li><li>Progress sync</li></ul>'
                    }
                ]
            }
        ];

        // Insert releases and features
        for (const release of releases) {
            try {
                // Get product id
                const product = await get('SELECT id FROM products WHERE slug = ?', [release.product_slug]);
                if (!product) {
                    console.error(`Product not found: ${release.product_slug}`);
                    continue;
                }

                console.log(`Inserting release ${release.version} for product ${release.product_slug}`);

                // Insert release
                const result = await run(
                    'INSERT OR IGNORE INTO releases (product_id, version, release_date) VALUES (?, ?, ?)',
                    [product.id, release.version, release.release_date]
                );

                // Get release id (either from new insert or existing record)
                const releaseRecord = await get(
                    'SELECT id FROM releases WHERE product_id = ? AND version = ?',
                    [product.id, release.version]
                );

                if (!releaseRecord || !releaseRecord.id) {
                    console.error(`Failed to get release ID for ${release.version}`);
                    continue;
                }

                console.log(`Inserting features for release ${release.version}`);

                // Start a transaction for feature insertion
                await run('BEGIN TRANSACTION');

                try {
                    // Insert features
                    for (const feature of release.features) {
                        try {
                            // First check if feature exists for this release
                            const existingFeature = await get(
                                'SELECT id FROM features WHERE release_id = ? AND title = ?',
                                [releaseRecord.id, feature.title]
                            );

                            if (existingFeature) {
                                // Update existing feature
                                await run(
                                    'UPDATE features SET content = ? WHERE id = ?',
                                    [feature.content, existingFeature.id]
                                );
                                console.log(`Updated feature: ${feature.title}`);
                            } else {
                                // Insert new feature
                                await run(
                                    'INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)',
                                    [releaseRecord.id, feature.title, feature.content]
                                );
                                console.log(`Inserted feature: ${feature.title}`);
                            }
                        } catch (err) {
                            console.error(`Error processing feature for release ${releaseRecord.id}:`, err);
                            // Rollback the transaction on error
                            await run('ROLLBACK');
                            throw err;
                        }
                    }

                    // Commit the transaction if all features were processed successfully
                    await run('COMMIT');
                } catch (err) {
                    // Rollback the transaction on any error
                    await run('ROLLBACK');
                    throw err;
                }
            } catch (err) {
                console.error(`Error processing release ${release.version}:`, err);
            }
        }

        console.log('Database initialized with sample data');
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
};

// Initialize the database
const initPromise = initDb().catch(err => {
    console.error('Error initializing database:', err);
    process.exit(1);
});

// Export the database connection and initialization promise
module.exports = {
    db,
    initPromise
}; 