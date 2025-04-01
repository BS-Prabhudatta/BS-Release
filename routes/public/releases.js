const express = require('express');
const router = express.Router();
const { db } = require('../../db/init');

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
    // ... existing code ...
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
router.get('/:product', (req, res) => {
    const { product } = req.params;
    
    // First, verify the product exists
    db.get('SELECT * FROM products WHERE slug = ?', [product], (err, productData) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).render('error', { message: 'Failed to load product' });
        }
        
        if (!productData) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Get all releases with their features
        db.all(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                GROUP_CONCAT(f.title, '||') as feature_titles,
                GROUP_CONCAT(f.content, '||') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = ?
            GROUP BY r.id
            ORDER BY r.release_date DESC
        `, [productData.id], (err, releases) => {
            if (err) {
                console.error('Error fetching releases:', err);
                return res.status(500).render('error', { message: 'Failed to load releases' });
            }

            // Process the releases to format features properly
            const formattedReleases = releases.map(release => ({
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
        });
    });
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
router.get('/:product/:version', (req, res) => {
    const { product, version } = req.params;

    db.get(`
        SELECT 
            p.*, 
            r.version,
            r.release_date,
            r.id as release_id
        FROM products p
        JOIN releases r ON r.product_id = p.id
        WHERE p.slug = ? AND r.version = ?
    `, [product, version], (err, releaseData) => {
        if (err) {
            console.error('Error fetching release:', err);
            return res.status(500).render('error', { message: 'Failed to load release' });
        }

        if (!releaseData) {
            return res.status(404).render('error', { message: 'Release not found' });
        }

        // Get features for this release
        db.all(`
            SELECT * FROM features 
            WHERE release_id = ? 
            ORDER BY id
        `, [releaseData.release_id], (err, features) => {
            if (err) {
                console.error('Error fetching features:', err);
                return res.status(500).render('error', { message: 'Failed to load features' });
            }

            res.render('release', { 
                product: releaseData, 
                release: {
                    version: releaseData.version,
                    release_date: releaseData.release_date,
                    features
                }
            });
        });
    });
});

module.exports = router; 