# FinTrack - Complete Azure Deployment Guide
## For Azure for Students Account (Free/Low-Cost Services)

---

## ✅ DEPLOYMENT COMPLETED!

### 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://stfintrack8803.z23.web.core.windows.net/ |
| **Backend API** | https://fintrack-backend-7844.azurewebsites.net |
| **ML API** | https://fintrack-ml-7844.azurewebsites.net |
| **MySQL** | mysqlfintrack7844.mysql.database.azure.com |
| **Cosmos DB** | cosmosfintrack7844.mongo.cosmos.azure.com |

### 🔐 Credentials

| Service | Username | Password |
|---------|----------|----------|
| MySQL | fintrackadmin | FinTrack@Azure2024! |
| Deploy User | fintrackdeploy7844 | DeployPass@2024! |

---

## 📋 Remaining Steps

### 1. Deploy Backend Code via GitHub Actions

Add this secret to your GitHub repo (Settings → Secrets → Actions):

**Secret Name:** `AZURE_BACKEND_PUBLISH_PROFILE`  
**Value:** Contents of `C:\temp\backend-publish-profile.xml`

### 2. Deploy ML Code via GitHub Actions

**Secret Name:** `AZURE_ML_PUBLISH_PROFILE`  
**Value:** Contents of `C:\temp\ml-publish-profile.xml`

### 3. Import MySQL Schema

```bash
mysql -h mysqlfintrack7844.mysql.database.azure.com \
  -u fintrackadmin -p \
  --ssl-mode=REQUIRED \
  fintrack_final < database/mysql/01_create_tables.sql
```

### 4. Push to GitHub to Trigger Deployment

```bash
git add .
git commit -m "Deploy to Azure"
git push origin main
```

---

## 📋 Pre-Deployment Checklist

- [ ] Azure for Students subscription active
- [ ] Azure CLI installed (`winget install Microsoft.AzureCLI`)
- [ ] Git repository ready (GitHub/Azure DevOps)
- [ ] Node.js 20+ installed locally (for testing)
- [ ] Python 3.11+ installed locally (for ML testing)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        AZURE CLOUD (Student Account)                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│   │  Static Web App │───▶│   App Service   │───▶│   App Service   │     │
│   │   (Frontend)    │    │  (Backend API)  │    │   (ML/FastAPI)  │     │
│   │   React/Vite    │    │   Node.js 20    │    │   Python 3.11   │     │
│   │     FREE        │    │   F1 Free       │    │    F1 Free      │     │
│   └─────────────────┘    └────────┬────────┘    └─────────────────┘     │
│                                   │                                      │
│                   ┌───────────────┴───────────────┐                     │
│                   ▼                               ▼                     │
│         ┌─────────────────┐           ┌─────────────────┐              │
│         │ MySQL Flexible  │           │   Cosmos DB     │              │
│         │    Server       │           │  (MongoDB API)  │              │
│         │ B1ms Free 12mo  │           │   FREE Tier     │              │
│         └─────────────────┘           └─────────────────┘              │
│                                                                          │
│   ┌─────────────────┐    ┌─────────────────┐                           │
│   │   Key Vault     │    │ App Insights    │                           │
│   │  (Secrets)      │    │  (Monitoring)   │                           │
│   │     FREE        │    │     FREE        │                           │
│   └─────────────────┘    └─────────────────┘                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Deployment Order (CRITICAL!)

You **MUST** create resources in this order:

1. **Resource Group** - Container for all resources
2. **Key Vault** - For storing secrets securely
3. **MySQL Flexible Server** - Main database (generates connection string)
4. **Cosmos DB** - Log database (generates connection string)
5. **App Service Plan** - Shared compute for both APIs
6. **Backend App Service** - Needs DB connection strings
7. **ML App Service** - Independent FastAPI service
8. **Static Web App** - Needs Backend API URL
9. **Application Insights** - Monitoring
10. **GitHub Actions** - CI/CD pipelines

---

## 🚀 Step-by-Step Deployment

### Step 1: Login to Azure

```powershell
# Install Azure CLI if needed
winget install Microsoft.AzureCLI

# Login
az login

# Verify student subscription
az account show

# If you have multiple subscriptions, set the student one
az account set --subscription "Azure for Students"
```

### Step 2: Create Resource Group

```bash
az group create \
  --name rg-fintrack-student \
  --location eastus
```

### Step 3: Create Key Vault

```bash
az keyvault create \
  --name kv-fintrack-student \
  --resource-group rg-fintrack-student \
  --location eastus \
  --sku standard
```

### Step 4: Create MySQL Flexible Server

```bash
# Create server (B1ms = Free for 12 months with Student account)
az mysql flexible-server create \
  --resource-group rg-fintrack-student \
  --name mysql-fintrack-student \
  --location eastus \
  --admin-user fintrackadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 20 \
  --version 8.0.21 \
  --public-access 0.0.0.0

# Create database
az mysql flexible-server db create \
  --resource-group rg-fintrack-student \
  --server-name mysql-fintrack-student \
  --database-name fintrack_final

# Allow Azure services to connect
az mysql flexible-server firewall-rule create \
  --resource-group rg-fintrack-student \
  --name mysql-fintrack-student \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 5: Create Cosmos DB (MongoDB API)

```bash
# Create account with Free Tier
az cosmosdb create \
  --name cosmos-fintrack-student \
  --resource-group rg-fintrack-student \
  --kind MongoDB \
  --server-version 4.2 \
  --enable-free-tier true \
  --default-consistency-level Session

# Create database
az cosmosdb mongodb database create \
  --account-name cosmos-fintrack-student \
  --resource-group rg-fintrack-student \
  --name fintrack
```

### Step 6: Create App Service Plan

```bash
az appservice plan create \
  --name plan-fintrack-student \
  --resource-group rg-fintrack-student \
  --is-linux \
  --sku F1
```

### Step 7: Create Backend App Service

```bash
az webapp create \
  --name fintrack-backend-api \
  --resource-group rg-fintrack-student \
  --plan plan-fintrack-student \
  --runtime "NODE:20-lts"
```

### Step 8: Create ML App Service

```bash
az webapp create \
  --name fintrack-ml-api \
  --resource-group rg-fintrack-student \
  --plan plan-fintrack-student \
  --runtime "PYTHON:3.11"

# Set startup command
az webapp config set \
  --name fintrack-ml-api \
  --resource-group rg-fintrack-student \
  --startup-file "gunicorn -w 2 -k uvicorn.workers.UvicornWorker api:app --bind 0.0.0.0:8000"
```

### Step 9: Create Static Web App (Portal Recommended)

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource** → Search **Static Web Apps**
3. Configure:
   - **Subscription**: Azure for Students
   - **Resource Group**: rg-fintrack-student
   - **Name**: fintrack-frontend
   - **Plan**: Free
   - **Region**: East US 2
   - **Source**: GitHub
   - **Organization**: Your GitHub username
   - **Repository**: Your repo name
   - **Branch**: main
   - **Build Presets**: React
   - **App location**: `/frontend`
   - **Output location**: `dist`
4. Click **Review + create** → **Create**

---

## ⚙️ Environment Variables Configuration

### Backend App Service

Go to **Azure Portal** → **App Services** → **fintrack-backend-api** → **Configuration** → **Application settings**

Add these settings:

| Name | Value |
|------|-------|
| `DB_HOST` | `mysql-fintrack-student.mysql.database.azure.com` |
| `DB_USER` | `fintrackadmin` |
| `DB_PASSWORD` | `YourSecurePassword123!` |
| `DB_NAME` | `fintrack_final` |
| `DB_PORT` | `3306` |
| `DB_SSL` | `true` |
| `MONGO_URI` | `mongodb://cosmos-fintrack-student:KEY@cosmos-fintrack-student.mongo.cosmos.azure.com:10255/fintrack?ssl=true&replicaSet=globaldb&retrywrites=false` |
| `ML_API_URL` | `https://fintrack-ml-api.azurewebsites.net` |
| `FRONTEND_URL` | `https://your-app.azurestaticapps.net` |
| `NODE_ENV` | `production` |

### Get Cosmos DB Connection String

```bash
az cosmosdb keys list \
  --name cosmos-fintrack-student \
  --resource-group rg-fintrack-student \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

### ML App Service

| Name | Value |
|------|-------|
| `WEBSITES_PORT` | `8000` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

### Static Web App (Frontend)

Go to **Static Web App** → **Configuration** → **Application settings**

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://fintrack-backend-api.azurewebsites.net` |

---

## 🔐 GitHub Secrets for CI/CD

### Get Publish Profiles

```bash
# Backend publish profile
az webapp deployment list-publishing-profiles \
  --name fintrack-backend-api \
  --resource-group rg-fintrack-student \
  --xml

# ML publish profile
az webapp deployment list-publishing-profiles \
  --name fintrack-ml-api \
  --resource-group rg-fintrack-student \
  --xml
```

### Add to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `AZURE_BACKEND_PUBLISH_PROFILE` - Paste backend XML
   - `AZURE_ML_PUBLISH_PROFILE` - Paste ML XML
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` - Get from Static Web App → Overview → Manage deployment token

3. Add these variables (Settings → Secrets and variables → Actions → Variables):
   - `VITE_API_URL` = `https://fintrack-backend-api.azurewebsites.net`

---

## 🗄️ Database Migration

### Import MySQL Schema to Azure

```bash
# Export local database
mysqldump -u root -p fintrack_final > fintrack_schema.sql

# Import to Azure MySQL
mysql -h mysql-fintrack-student.mysql.database.azure.com \
  -u fintrackadmin \
  -p \
  --ssl-mode=REQUIRED \
  fintrack_final < fintrack_schema.sql
```

Or use **MySQL Workbench**:
1. Connect to Azure MySQL with SSL enabled
2. Server Administration → Data Import
3. Import your local schema

---

## ✅ Verification Checklist

After deployment, verify each service:

### Backend API
```bash
curl https://fintrack-backend-api.azurewebsites.net/health
# Should return: {"status":"ok","database":"connected",...}
```

### ML API
```bash
curl https://fintrack-ml-api.azurewebsites.net/health
# Should return: {"status":"healthy","model_loaded":true}
```

### Frontend
Open `https://your-app.azurestaticapps.net` in browser

### Database Connection
Check **App Service** → **Log stream** for connection messages

---

## 💰 Cost Summary (Azure for Students)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Static Web Apps | Free | **$0** |
| App Service (Backend) | F1 | **$0** |
| App Service (ML) | F1 | **$0** |
| MySQL Flexible Server | B1ms | **$0** (12 months free) |
| Cosmos DB | Free Tier | **$0** (1000 RU/s) |
| Key Vault | Standard | **$0** (10k ops free) |
| Application Insights | Free | **$0** (5GB/month) |
| **Total** | | **$0/month** |

---

## 🔧 Troubleshooting

### Backend won't start
- Check **Deployment Center** → **Logs**
- Verify environment variables are set
- Check **Log stream** for errors

### Database connection fails
- Verify `DB_SSL=true` is set
- Check firewall rules allow Azure services
- Test connection with MySQL Workbench

### Frontend CORS errors
- Verify `FRONTEND_URL` is set in backend
- Check browser console for exact origin
- Ensure backend CORS config matches

### ML model not loading
- Check `model.pkl` is in the `ml/` folder
- Verify startup command is set correctly
- Check **Log stream** for Python errors

---

## 📞 Support

- Azure Student Support: https://azure.microsoft.com/en-us/free/students/
- Azure Status: https://status.azure.com/
- Documentation: https://docs.microsoft.com/azure/

