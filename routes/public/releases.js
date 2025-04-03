const express = require('express');
const router = express.Router();
const { query } = require('../../db/init');

/**
 * @swagger
 * /releases:
 *   get:
 *     summary: Get all releases for all products
 *     tags: [Public Releases]
 *     responses:
 *       200:
 *         description: List of all releases grouped by product
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   product:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                   releases:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         version:
 *                           type: string
 *                         release_date:
 *                           type: string
 *                           format: date
 *                         features:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               title:
 *                                 type: string
 *                               content:
 *                                 type: string
 *       500:
 *         description: Server error
 */
// Get all releases for all products
router.get('/', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                p.*,
                r.version as latest_version,
                r.release_date as latest_release_date
            FROM products p
            LEFT JOIN releases r ON r.product_id = p.id
            WHERE r.id = (
                SELECT id FROM releases 
                WHERE product_id = p.id 
                ORDER BY release_date DESC 
                LIMIT 1
            )
            ORDER BY p.name
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Failed to load products' });
    }
});

/**
 * @swagger
 * /releases/{product}:
 *   get:
 *     summary: Get all releases for a specific product
 *     tags: [Public Releases]
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *     responses:
 *       200:
 *         description: Product and its releases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                 releases:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       version:
 *                         type: string
 *                       release_date:
 *                         type: string
 *                         format: date
 *                       features:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             content:
 *                               type: string
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
// Get all releases for a product
router.get('/:product', async (req, res) => {
    const { product } = req.params;
    
    try {
        // First, verify the product exists
        const productResult = await query('SELECT * FROM products WHERE slug = $1', [product]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Product not found' });
        }
        
        const productData = productResult.rows[0];

        // Get all releases with their features
        const releasesResult = await query(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                string_agg(f.title, '||') as feature_titles,
                string_agg(f.content, '||') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = $1
            GROUP BY r.id, r.version, r.release_date
            ORDER BY r.release_date DESC
        `, [productData.id]);

        // Process the releases to format features properly
        const formattedReleases = releasesResult.rows.map(release => ({
            ...release,
            features: release.feature_titles ? release.feature_titles.split('||').map((title, index) => ({
                title,
                content: release.feature_contents.split('||')[index]
            })) : []
        }));

        res.render('releases', { 
            product: productData, 
            releases: formattedReleases 
        });
    } catch (err) {
        console.error('Error fetching releases:', err);
        res.status(500).render('error', { message: 'Failed to load releases' });
    }
});

/**
 * @swagger
 * /releases/{product}/{version}:
 *   get:
 *     summary: Get specific release details
 *     tags: [Public Releases]
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *         description: Version number in format x.x.x
 *     responses:
 *       200:
 *         description: Release details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 version:
 *                   type: string
 *                 release_date:
 *                   type: string
 *                   format: date
 *                 product_name:
 *                   type: string
 *                 product_slug:
 *                   type: string
 *                 features:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *       404:
 *         description: Release not found
 *       500:
 *         description: Server error
 */
// Get specific release
router.get('/:product/:version', async (req, res) => {
    const { product, version } = req.params;

    try {
        const releaseResult = await query(`
            SELECT 
                p.*, 
                r.version,
                r.release_date,
                r.id as release_id
            FROM products p
            JOIN releases r ON r.product_id = p.id
            WHERE p.slug = $1 AND r.version = $2
        `, [product, version]);

        if (releaseResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Release not found' });
        }

        const releaseData = releaseResult.rows[0];

        // Get features for this release
        const featuresResult = await query(`
            SELECT * FROM features 
            WHERE release_id = $1 
            ORDER BY id
        `, [releaseData.release_id]);

        res.render('release', { 
            product: releaseData, 
            release: {
                version: releaseData.version,
                release_date: releaseData.release_date,
                features: featuresResult.rows
            }
        });
    } catch (err) {
        console.error('Error fetching release:', err);
        res.status(500).render('error', { message: 'Failed to load release' });
    }
});

module.exports = router; 