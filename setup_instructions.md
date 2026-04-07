# FinTrack SecureAI - Production & Azure Deployment Guide

This guide covers the setup, testing, and deployment process for the FinTrack SecureAI platform, addressing the new Machine Learning service, Event-Driven Alerts, and Azure Cloud readiness.

## 1. Local Setup

### Step 1.1: Backend Setup
1. Open the `.env` file in the root directory. Ensure your MySQL database credentials (`DB_USER`, `DB_PASSWORD`, `DB_NAME`) are correct.
2. In a terminal, navigate to the `backend` folder.
3. Start the node server:
   ```bash
   node server.js
   ```
4. On startup, the `ensureSchema` script will automatically add `fraud_score`, `fraud_flag`, and `fraud_reason` columns to your MySQL `TRANSACTION` table.

### Step 1.2: ML Microservice Setup
The ML microservice uses a hybrid **XGBoost + Isolation Forest** model with SHAP explanations.

1. Navigate to the `backend/ml-service/` folder.
2. Install Python dependencies:
   ```bash
   pip install fastapi uvicorn pydantic scikit-learn xgboost shap pandas numpy
   ```
3. Generate synthetic data and Train the model:
   ```bash
   python train_model.py
   ```
   *This will generate a `model.pkl` file locally.*
4. Start the ML prediction server:
   ```bash
   uvicorn predict:app --reload --host 0.0.0.0 --port 8000
   ```
5. Endpoint is available at `http://localhost:8000/predict`.

## 2. Using the System

### 2.1 Transaction Flow & ML Integration
When you create a transaction via the backend (e.g. `POST /api/transactions/`), the system will:
* Send the data to the ML API.
* Receive a `fraud_score`, `fraud_flag` (SAFE/SUSPICIOUS/FRAUD) and an intelligent `reason` based on SHAP values.
* If the ML service is down, the system **gracefully falls back** to `SAFE`.
* Triggers the NodeJS Event (`fraudEvents.js`).
* If `FRAUD` is detected, it logs to the `AUDIT_LOG` table immediately, and `HTTP 201` includes a warning message.

### 2.2 Chatbot AI
The `/api/chatbot/message` route has been enhanced. If you send:
`"Any fraud alerts?"` or `"Why was my transaction flagged?"` 
The bot queries your transaction history and provides a dynamic response utilizing the newly saved `fraud_reason`.

### 2.3 Admin API
The Admin dashboard has 2 new endpoints:
- `GET /api/admin/fraud-transactions`: Returns a list of all transactions marked as 'FRAUD'.
- `GET /api/admin/fraud-summary`: Returns the total count, average score, and top 10 recent fraudulent events.

## 3. Azure Migration Readiness (Step 10)

The system has been prepared for Azure migration:
- `db.js` now dynamically checks for Azure SSL configurations.
- `.env` includes stub endpoints for `DB_HOST` (azure-db-server.database.windows.net), `DB_SSL=true`, and App Insights.

### Migration Procedure:
1. **Azure SQL Database**: Export your local `fintrack_final` MySQL database using `mysqldump`. Use tools like *SQL Server Migration Assistant (SSMA) for MySQL* to migrate the schema to Azure SQL, or host in an Azure Database for MySQL flexible server.
2. **App Service (Backend)**:
   - Deploy the `backend` folder to an Azure App Service (Node.js 18+).
   - Set the Azure App Service environment variables to match your Azure SQL server values from the `.env` snippet.
3. **Azure Functions/App Service (ML API)**:
   - Deploy `backend/ml-service` to a Python Azure Function or a separate Python App Service.
   - Set the `ML_API_URL` environment variable on the Node app to point to your new `.azurewebsites.net` URL.
4. **Monitoring**:
   - Application Insights strings can be appended to the environment configuration to track telemetry.
