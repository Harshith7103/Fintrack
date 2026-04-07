const neo4j = require('neo4j-driver');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

let session;

const initNeo4j = async () => {
    try {
        await driver.verifyConnectivity();
        console.log('✅ Connected to Neo4j successfully.');
    } catch (error) {
        console.error('Error connecting to Neo4j:', error);
    }
};

const getSession = () => {
    return driver.session();
};

const closeNeo4j = async () => {
    await driver.close();
};

// Functions to sync data to Neo4j
const syncUserToNeo4j = async (userId, name) => {
    const s = getSession();
    try {
        await s.run(
            `MERGE (u:User {id: $userId})
             SET u.name = $name`,
            { userId: parseInt(userId), name }
        );
    } catch (err) {
        console.error('Neo4j sync error:', err);
    } finally {
        await s.close();
    }
};

const syncTransactionToNeo4j = async (txnId, userId, accountId, categoryId, amount, type) => {
    const s = getSession();
    try {
        await s.run(
            `MATCH (u:User {id: $userId})
             MERGE (a:Account {id: $accountId})
             MERGE (c:Category {id: COALESCE($categoryId, 0)})
             MERGE (t:Transaction {id: $txnId})
             SET t.amount = $amount, t.type = $type
             MERGE (u)-[:OWNS]->(a)
             MERGE (t)-[:BELONGS_TO]->(c)
             MERGE (a)-[:HAS_TRANSACTION]->(t)`,
            {
                txnId: parseInt(txnId),
                userId: parseInt(userId),
                accountId: parseInt(accountId),
                categoryId: categoryId ? parseInt(categoryId) : 0,
                amount: parseFloat(amount),
                type
            }
        );
    } catch (err) {
        console.error('Neo4j sync txn error:', err);
    } finally {
        await s.close();
    }
};

module.exports = {
    driver,
    initNeo4j,
    getSession,
    closeNeo4j,
    syncUserToNeo4j,
    syncTransactionToNeo4j
};
