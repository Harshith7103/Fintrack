# FINTRACK AZURE - QUICK REFERENCE CARD

## 🎯 YOUR AZURE RESOURCES

### Databases
```
MySQL Server:     mysqlfintrack7844.mysql.database.azure.com
Cosmos DB:        cosmosfintrack7844.documents.azure.com
Database:         fintrack_final
User:             fintrackadmin
Password:         FinTrack@Azure2024!
Region:           Southeast Asia
```

### APIs (Live Now ✅)
```
Backend:  https://fintrack-backend.azurewebsites.net/
ML API:   https://fintrack-ml.azurewebsites.net/
Health:   https://fintrack-backend.azurewebsites.net/health
```

### Resource Group
```
az group show --name rg-fintrack-student
```

---

## ⏳ NEXT 3 STEPS (15 minutes total)

### Step 1: Create Static Web App (5 min)
```
1. Go to https://portal.azure.com
2. Create Resource → Static Web App → Free Tier
3. GitHub: YOUR_REPO, Branch: main
4. App location: /frontend, Output: dist
5. Create
```

### Step 2: Import MySQL Schema (5 min)
```
1. Go to portal.azure.com → Cloud Shell
2. Download schema:
   wget https://raw.githubusercontent.com/YOUR_ORG/fintrack/main/database/mysql/01_create_tables.sql

3. Import:
   mysql -h mysqlfintrack7844.mysql.database.azure.com \
   -u fintrackadmin \
   -p "FinTrack@Azure2024!" \
   --ssl-mode=REQUIRED \
   fintrack_final < 01_create_tables.sql
```

### Step 3: Add GitHub Secrets (3 min)
```
1. Repo → Settings → Secrets and variables → Actions

2. Get Backend Publish Profile:
   az webapp deployment list-publishing-profiles \
   --name fintrack-backend \
   --resource-group rg-fintrack-student --xml

3. Get ML Publish Profile:
   az webapp deployment list-publishing-profiles \
   --name fintrack-ml \
   --resource-group rg-fintrack-student --xml

4. Add as secrets:
   - AZURE_BACKEND_PUBLISH_PROFILE
   - AZURE_ML_PUBLISH_PROFILE
   - AZURE_STATIC_WEB_APPS_API_TOKEN

5. Add as variables:
   - VITE_API_URL = https://fintrack-backend.azurewebsites.net
```

---

## 🚀 DEPLOY!

```bash
git add .
git commit -m "Deploy FinTrack to Azure"
git push origin main
```

Auto-deploys all 3 services! 🎉

---

## 📊 USEFUL COMMANDS

### View Logs
```bash
# Backend logs
az webapp log tail --name fintrack-backend --resource-group rg-fintrack-student

# ML logs
az webapp log tail --name fintrack-ml --resource-group rg-fintrack-student
```

### Update Environment Variables
```bash
az webapp config appsettings set \
  --name fintrack-backend \
  --resource-group rg-fintrack-student \
  --settings KEY=VALUE
```

### Restart App
```bash
az webapp restart --name fintrack-backend --resource-group rg-fintrack-student
```

### View Connection String
```bash
az cosmosdb keys list \
  --name cosmosfintrack7844 \
  --resource-group rg-fintrack-student \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv
```

---

## 🔗 ENVIRONMENT VARIABLES (Already Set)

```
DB_HOST=mysqlfintrack7844.mysql.database.azure.com
DB_USER=fintrackadmin
DB_PASSWORD=FinTrack@Azure2024!
DB_NAME=fintrack_final
DB_PORT=3306
DB_SSL=true
MONGO_URI=<cosmos-connection-string>
ML_API_URL=https://fintrack-ml.azurewebsites.net
NODE_ENV=production
WEBSITES_PORT=8000
```

---

## 💰 COST

**$0/month** ✅

- Static Web Apps: Free
- App Service F1: Free
- MySQL B1ms: Free (12 months)
- Cosmos DB Free Tier: Free (1000 RU/s)

---

## ✅ TEST YOUR DEPLOYMENT

```bash
# Backend health
curl https://fintrack-backend.azurewebsites.net/health

# ML health
curl https://fintrack-ml.azurewebsites.net/health

# ML prediction test
curl -X POST https://fintrack-ml.azurewebsites.net/predict-fraud \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "user_id": 1}'
```

---

## 📖 DOCUMENTATION

- **DEPLOYMENT_COMPLETE.md** - Full summary (READ THIS FIRST)
- **AZURE_DEPLOYMENT_FINAL.md** - Detailed step-by-step
- **AZURE_DEPLOYMENT_GUIDE.md** - Advanced options

---

## 🆘 PROBLEMS?

**Backend won't start:**
```bash
az webapp log tail --name fintrack-backend --resource-group rg-fintrack-student
```

**Database connection fails:**
- Check password: FinTrack@Azure2024!
- Verify SSL: DB_SSL=true
- Check firewall: az mysql flexible-server firewall-rule list ...

**CORS errors:**
- Set FRONTEND_URL in backend config
- Must match Static Web App URL exactly

**ML model missing:**
- Ensure ml/model.pkl exists
- Check ML logs for Python errors

---

## 🎯 YOUR LIVE SYSTEM

```
https://fintrack-frontend.azurestaticapps.net
                    ↓
         Auto-fetches API from:
         https://fintrack-backend.azurewebsites.net
                    ↓
         Connects to MySQL & Cosmos DB
         In Southeast Asia
```

**All code auto-redeploys when you push to GitHub!** 🚀

---

## 🔗 IMPORTANT LINKS

- Azure Portal: https://portal.azure.com
- Your Resource Group: https://portal.azure.com/#@/resource/subscriptions/65d6a37f-f902-4c53-a9bd-c0a2fc2f5726/resourceGroups/rg-fintrack-student
- GitHub Actions: Your Repo → Actions tab

---

**🎉 You're Done!**

Follow the 3 steps above, push your code, and FinTrack is live!
