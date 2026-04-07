# FinTrack SecureAI – Azure Deployment Guide (Free Tier)

## Architecture

```
Azure Static Web Apps  →  React Frontend
Azure App Service      →  Node.js Backend (Free F1 tier)
Azure SQL Database     →  MySQL-compatible (Basic tier)
Azure App Service      →  Python ML API (Free F1 tier)
Azure Bot Service      →  Future chatbot upgrade
```

---

## Phase 7 Checklist (Pre-Deployment)

### 1. Backend – Environment Variables
All secrets are in `.env` (never commit this file).
Copy `.env.example` → `.env` and fill in Azure values.

### 2. Database – Export Schema
```bash
# Export schema + seed data
mysqldump -u root -p fintrack > database/mysql/fintrack_export.sql
```

### 3. ML Model – Save Pickle
```bash
cd ml
pip install -r requirements.txt
python fraud_model.py   # generates model.pkl
```

### 4. CORS – Already enabled in server.js

---

## Deployment Steps

### Frontend (Azure Static Web Apps)
```bash
cd frontend
npm run build
# Deploy dist/ folder to Azure Static Web Apps
# Set VITE_API_URL=https://your-backend.azurewebsites.net/api
```

### Backend (Azure App Service)
```bash
# Set environment variables in Azure Portal → App Service → Configuration
# Deploy via GitHub Actions or zip deploy
az webapp up --name fintrack-backend --resource-group fintrack-rg --runtime "NODE:20-lts"
```

### ML API (Azure App Service – Python)
```bash
cd ml
# Deploy via zip or GitHub Actions
az webapp up --name fintrack-ml --resource-group fintrack-rg --runtime "PYTHON:3.11"
# Set startup command: uvicorn api:app --host 0.0.0.0 --port 8000
```

### Database (Azure SQL / MySQL Flexible Server)
```bash
# Import schema
mysql -h your-server.mysql.database.azure.com -u admin -p fintrack < database/mysql/fintrack_export.sql
```

---

## Free Tier Limits
| Service | Free Tier |
|---------|-----------|
| App Service (F1) | 60 CPU min/day, 1 GB RAM |
| Static Web Apps | 100 GB bandwidth/month |
| Azure SQL (Basic) | 2 GB storage |
| Azure ML | Limited compute |

---

## Local Development
```bash
# Terminal 1 – Backend
cd "FINTRACK FINAL"
npm run dev

# Terminal 2 – Frontend
cd "FINTRACK FINAL/frontend"
npm run dev

# Terminal 3 – ML API (optional)
cd "FINTRACK FINAL/ml"
pip install -r requirements.txt
python fraud_model.py        # train model first
uvicorn api:app --reload --port 8000
```
