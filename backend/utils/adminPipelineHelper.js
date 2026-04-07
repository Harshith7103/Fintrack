const db = require('../db');
const { ensureMongo } = require('./mongoReady');
const { syncAllSqlTransactionsToMongo } = require('./syncHelper');

/**
 * Ensures MongoDB mirrors MySQL TRANSACTION for every user before admin pipeline runs.
 * @returns {Promise<boolean>} false if response already sent (error)
 */
async function refreshMongoTransactionsForAdmin(res) {
    if (!ensureMongo(res)) return false;
    try {
        await syncAllSqlTransactionsToMongo();
        return true;
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
        return false;
    }
}

async function buildUserNameMap(userIds) {
    const ids = [...new Set((userIds || []).map(Number).filter((n) => !Number.isNaN(n)))];
    if (!ids.length) return new Map();
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT User_ID, Name, Email FROM USERS WHERE User_ID IN (${placeholders})`,
        ids
    );
    const m = new Map();
    for (const r of rows) {
        const id = Number(r.User_ID ?? r.user_id);
        if (Number.isNaN(id)) continue;
        m.set(id, {
            name: r.Name ?? r.name ?? `User #${id}`,
            email: r.Email ?? r.email ?? '',
        });
    }
    return m;
}

/**
 * @param {Array} rows pipeline documents
 * @param {(row: object) => number|undefined} getUserId
 */
async function attachUserNames(rows, getUserId) {
    if (!rows || !rows.length) return rows;
    const getter =
        getUserId ||
        ((r) => {
            if (r.user_id != null) return r.user_id;
            if (r._id != null) return r._id;
            return undefined;
        });
    const map = await buildUserNameMap(rows.map(getter));
    return rows.map((r) => {
        const uid = Number(getter(r));
        const u = Number.isNaN(uid) ? null : map.get(uid);
        return {
            ...r,
            user_name: u?.name ?? null,
            user_email: u?.email ?? null,
        };
    });
}

module.exports = {
    refreshMongoTransactionsForAdmin,
    buildUserNameMap,
    attachUserNames,
};
