const mongoose = require('mongoose');

/** @returns {boolean} true if connected (HTTP response already sent if false) */
function ensureMongo(res) {
    if (mongoose.connection.readyState === 1) return true;
    res.status(503).json({
        success: false,
        error:
            'MongoDB is not connected. Start mongod, set MONGO_URI in .env, and restart the API server.',
    });
    return false;
}

module.exports = { ensureMongo };
