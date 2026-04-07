const express = require('express');
const router = express.Router();
const { getSession } = require('../neo4j');

// Get graph data for visualization
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (n)-[r]->(m)
            RETURN n, r, m
            LIMIT 100
        `);

        // Format for frontend graph library
        const nodes = [];
        const links = [];
        const addedNodes = new Set();

        result.records.forEach(record => {
            const n = record.get('n');
            const m = record.get('m');
            const r = record.get('r');

            if (!addedNodes.has(n.identity.low)) {
                nodes.push({ id: n.identity.low, label: n.labels[0], properties: n.properties });
                addedNodes.add(n.identity.low);
            }
            if (!addedNodes.has(m.identity.low)) {
                nodes.push({ id: m.identity.low, label: m.labels[0], properties: m.properties });
                addedNodes.add(m.identity.low);
            }

            links.push({
                source: n.identity.low,
                target: m.identity.low,
                type: r.type
            });
        });

        res.json({ nodes, links });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
