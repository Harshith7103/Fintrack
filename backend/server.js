const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== CORS CONFIGURATION FOR AZURE ====================
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',           // Vite dev server
            'http://localhost:5174',
            'http://localhost:3000',
            process.env.FRONTEND_URL,          // Azure Static Web App URL
            /\.azurestaticapps\.net$/,         // All Azure Static Web Apps
        ].filter(Boolean);

        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) return allowed.test(origin);
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/emi', require('./routes/emi'));
app.use('/api/budget-funds', require('./routes/budgetFund'));
app.use('/api/savings', require('./routes/savings'));
app.use('/api/budget', require('./routes/budget'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit', require('./routes/audit')); // Add Audit Routes
app.use('/api/graph', require('./routes/graph'));
app.use('/api/mongo', require('./routes/mongoData'));
app.use('/api/admin', require('./routes/admin')); // NEW ADMIN ROUTES
app.use('/api', require('./routes/pipelineStages')); // Pipeline analyzer: /match, /group, /project, /sort, /fullPipeline
app.use('/api/fraud', require('./routes/fraud'));   // Fraud detection
app.use('/api/fraud/simulate', require('./routes/simulation')); // Fraud simulation
app.use('/api/chatbot', require('./routes/chatbot')); // Chatbot

// Root Endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: "FinTrack API is running on Azure",
        status: "healthy",
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint for Azure monitoring
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

const { initMongoDB } = require('./mongodb');
const { ensureUserAccountStatusColumn, ensureFraudColumns } = require('./utils/ensureSchema');

async function start() {
    try {
        await ensureUserAccountStatusColumn();
        await ensureFraudColumns();
    } catch (e) {
        console.warn('Startup: schema ensure failed:', e.message);
    }
    try {
        await initMongoDB();
    } catch (e) {
        console.error('Startup: Neo4j/Mongo init failed:', e.message);
    }
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Database simulation initialized.`);
        console.log(`[admin] User activity: GET /api/admin/activity/:userId (also /api/admin/users/:id/activity)`);
    });
}

start();
