# FinTrack Azure Deployment - COMPLETE SETUP GUIDE

## ✅ DEPLOYMENT STATUS: 80% COMPLETE

### What's Deployed ✅
- ✅ **MySQL Flexible Server** (B1ms - Free 12 months)
- ✅ **Cosmos DB MongoDB API** (Free Tier)
- ✅ **App Service Plan** (F1 Free)
- ✅ **Backend API** (Node.js 20 LTS)
- ✅ **ML API** (Python 3.11)
- ✅ **Environment Variables** configured

### What Needs Manual Steps ⏳
- ⏳ Import MySQL schema
- ⏳ Create Static Web App for frontend
- ⏳ Set up GitHub Actions secrets

---

## 📊 Your Azure Resources

### **Endpoints**
```
Backend API:    https://fintrack-backend.azurewebsites.net
ML API:         https://fintrack-ml.azurewebsites.net
MySQL:          mysqlfintrack7844.mysql.database.azure.com
Cosmos DB:      cosmosfintrack7844.documents.azure.com
```

### **Credentials**
```
MySQL User:         fintrackadmin
MySQL Password:     FinTrack@Azure2024!
Region:             Southeast Asia
Resource Group:     rg-fintrack-student
```

---

## 🔧 NEXT STEPS

### Step 1: Import MySQL Schema

**Option A: Using Azure Cloud Shell (RECOMMENDED)**
1. Go to https://portal.azure.com
2. Click **Cloud Shell** (top right >_)
3. Ensure PowerShell is selected
4. Run:
```bash
cd ~
wget https://raw.githubusercontent.com/YOUR_REPO/main/database/mysql/01_create_tables.sql
mysql -h mysqlfintrack7844.mysql.database.azure.com \
  -u fintrackadmin \
  -p "FinTrack@Azure2024!" \
  --ssl-mode=REQUIRED \
  fintrack_final < 01_create_tables.sql
```

**Option B: Using MySQL Workbench**
1. Download MySQL Workbench from https://www.mysql.com/products/workbench/
2. Create connection:
   - Hostname: `mysqlfintrack7844.mysql.database.azure.com`
   - Username: `fintrackadmin`
   - Password: `FinTrack@Azure2024!`
   - Port: 3306
   - Default Schema: `fintrack_final`
   - **Enable SSL/TLS**
3. File → Open SQL Script → Select `database/mysql/01_create_tables.sql`
4. Execute

**Option C: Using Python Script**
```python
import mysql.connector

conn = mysql.connector.connect(
    host='mysqlfintrack7844.mysql.database.azure.com',
    user='fintrackadmin',
    password='FinTrack@Azure2024!',
    database='fintrack_final',
    ssl_disabled=False
)

cursor = conn.cursor()
with open('database/mysql/01_create_tables.sql', 'r') as f:
    schema = f.read()
    for statement in schema.split(';'):
        if statement.strip():
            cursor.execute(statement)
conn.commit()
print("✅ Schema imported successfully")
```

---

### Step 2: Create Static Web App for Frontend

1. Go to **[Azure Portal](https://portal.azure.com)**
2. Click **+ Create a resource**
3. Search **"Static Web App"** and click **Create**
4. Fill in:

| Setting | Value |
|---------|-------|
| Subscription | Azure for Students |
| Resource group | `rg-fintrack-student` |
| Name | `fintrack-frontend` |
| Plan type | **Free** |
| Region | **East US 2** |
| Source | **GitHub** |
| Organization | Your GitHub username |
| Repository | Your FinTrack repo |
| Branch | `main` |
| Build Presets | **React** |
| App location | `/frontend` |
| Output location | `dist` |
| API location | (leave blank) |

5. Click **Review + Create** → **Create**

Once created, note your Static Web App URL (e.g., `https://xxx.azurestaticapps.net`)

---

### Step 3: Update Backend Config with Static Web App URL

After getting your Static Web App URL:

```bash
az webapp config appsettings set \
  --name fintrack-backend \
  --resource-group rg-fintrack-student \
  --settings FRONTEND_URL="https://YOUR_STATIC_APP_URL.azurestaticapps.net"
```

---

### Step 4: GitHub Secrets for CI/CD

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

2. **Add these Secrets:**

#### `AZURE_BACKEND_PUBLISH_PROFILE`
```bash
az webapp deployment list-publishing-profiles \
  --name fintrack-backend \
  --resource-group rg-fintrack-student \
  --xml
```
Copy the output and paste as secret value.

#### `AZURE_ML_PUBLISH_PROFILE`
```bash
az webapp deployment list-publishing-profiles \
  --name fintrack-ml \
  --resource-group rg-fintrack-student \
  --xml
```

#### `AZURE_STATIC_WEB_APPS_API_TOKEN`
1. Go to Static Web App → **Overview**
2. Click **Manage deployment token**
3. Copy and paste

3. **Add these Variables** (not secrets):

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://fintrack-backend.azurewebsites.net` |

---

### Step 5: Test Your Deployment

**Test Backend API:**
```bash
curl https://fintrack-backend.azurewebsites.net/health
# Expected: {"status":"ok","database":"connected",...}
```

**Test ML API:**
```bash
curl -X POST https://fintrack-ml.azurewebsites.net/predict-fraud \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "user_id": 1}'
# Expected: {"prediction":"Safe","score":...}
```

**Test Frontend:**
- Open: `https://fintrack-frontend.azurestaticapps.net`

---

### Step 6: Push Code to Trigger CI/CD

After setting up GitHub secrets and Static Web App:

```bash
git add .
git commit -m "Deploy FinTrack to Azure"
git push origin main
```

This will trigger:
- ✅ Backend deployment
- ✅ ML deployment  
- ✅ Frontend deployment

---

## 📋 MySQL Schema Import Scripts

If needed, run additional scripts in order:

```bash
# After 01_create_tables.sql:
mysql -h mysqlfintrack7844.mysql.database.azure.com \
  -u fintrackadmin -p "FinTrack@Azure2024!" \
  --ssl-mode=REQUIRED \
  fintrack_final < database/mysql/02_stored_procedures.sql

mysql -h mysqlfintrack7844.mysql.database.azure.com \
  -u fintrackadmin -p "FinTrack@Azure2024!" \
  --ssl-mode=REQUIRED \
  fintrack_final < database/mysql/03_triggers.sql

mysql -h mysqlfintrack7844.mysql.database.azure.com \
  -u fintrackadmin -p "FinTrack@Azure2024!" \
  --ssl-mode=REQUIRED \
  fintrack_final < database/mysql/05_seed_data.sql
```

---

## 🔐 Environment Variables

### Backend (`fintrack-backend`)
```
DB_HOST=mysqlfintrack7844.mysql.database.azure.com
DB_USER=fintrackadmin
DB_PASSWORD=FinTrack@Azure2024!
DB_NAME=fintrack_final
DB_PORT=3306
DB_SSL=true
MONGO_URI=mongodb://cosmosfintrack7844:PRIMARY_KEY@cosmosfintrack7844.mongo.cosmos.azure.com:10255/fintrack?ssl=true&replicaSet=globaldb&retrywrites=false
ML_API_URL=https://fintrack-ml.azurewebsites.net
FRONTEND_URL=https://YOUR_STATIC_APP_URL
NODE_ENV=production
```

### ML (`fintrack-ml`)
```
WEBSITES_PORT=8000
```

### Frontend (Static Web App)
```
VITE_API_URL=https://fintrack-backend.azurewebsites.net
```

---

## 🔗 Database Connection Strings

### MySQL
```
Server=mysqlfintrack7844.mysql.database.azure.com;
Database=fintrack_final;
Uid=fintrackadmin;
Pwd=FinTrack@Azure2024!;
SslMode=Required;
Port=3306;
```

### Cosmos DB
Get the connection string:
```bash
az cosmosdb keys list \
  --name cosmosfintrack7844 \
  --resource-group rg-fintrack-student \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

---

## 📊 Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Static Web Apps | Free | **$0** |
| App Service (Backend) | F1 | **$0** |
| App Service (ML) | F1 | **$0** |
| MySQL Flexible Server | B1ms | **$0** (12 months free) |
| Cosmos DB | Free Tier | **$0** (1000 RU/s) |
| **Total** | | **$0/month** |

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check logs
az webapp log tail --name fintrack-backend --resource-group rg-fintrack-student
```

### Database connection fails
```bash
# Verify firewall
az mysql flexible-server firewall-rule list \
  --server-name mysqlfintrack7844 \
  --resource-group rg-fintrack-student
```

### CORS errors in frontend
Ensure:
1. `FRONTEND_URL` is set in backend
2. Origin matches exactly: `https://YOUR_STATIC_APP_URL`

### ML model not loading
```bash
# Check startup
az webapp log tail --name fintrack-ml --resource-group rg-fintrack-student
```

---

## 📞 Support Links

- **Azure for Students**: https://azure.microsoft.com/en-us/free/students/
- **Azure Portal**: https://portal.azure.com
- **Azure Status**: https://status.azure.com
- **MySQL Docs**: https://docs.microsoft.com/azure/mysql/
- **Cosmos DB Docs**: https://docs.microsoft.com/azure/cosmos-db/

---

## 🎉 You're Done!

Your FinTrack system is now deployed on Azure!

```
Frontend:  https://fintrack-frontend.azurestaticapps.net
Backend:   https://fintrack-backend.azurewebsites.net/
ML:        https://fintrack-ml.azurewebsites.net/
```

All files automatically redeploy when you push to GitHub! 🚀
