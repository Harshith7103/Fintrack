// 1. Create User Node
CREATE (u:User {id: 101, name: 'Alice', trust_score: 85});

// 2. Create Account Nodes
CREATE (a1:Account {id: 1, type: 'Salary', bank: 'HDFC'});
CREATE (a2:Account {id: 2, type: 'Wallet', provider: 'Paytm'});

// 3. Establish Relationships (User owns Account)
MATCH (u:User {id: 101}), (a1:Account {id: 1})
MERGE (u)-[:OWNS]->(a1);

// 4. Record Transaction Relationship
// (Account)-[:PAID]->(Category)
CREATE (c:Category {name: 'Food'});
MATCH (a2:Account {id: 2}), (c:Category {name: 'Food'})
CREATE (a2)-[:PAID {amount: 500, date: '2024-02-14'}]->(c);

// 5. Query: Find Suspicious Transfers (Circular dependencies or high frequency)
MATCH (a1:Account)-[t:TRANSFERRED]->(a2:Account)
WHERE t.amount > 100000
RETURN a1, a2, t;

// 6. Recommendation: Find redundant expense categories
MATCH (u:User)-[:MADE]->(t:Transaction)-[:FOR]->(c:Category)
WITH c, count(t) as freq, sum(t.amount) as total
WHERE total > 5000
RETURN c.name, total ORDER BY total DESC;
