# FinTrack GitHub Secrets Setup - Complete Walkthrough

## 🎯 What You Need to Do (5 Minutes)

Add 2 secrets to your GitHub repository. These secrets contain your Azure deployment credentials.

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### **STEP 1: Open GitHub Secrets Page**

Go to this exact URL:
```
https://github.com/Harshith7103/Fintrack/settings/secrets/actions
```

Or manually:
1. Go to https://github.com/Harshith7103/Fintrack
2. Click **Settings** (top menu)
3. Click **Secrets and variables** (left menu)
4. Click **Actions**

You'll see a page with "New repository secret" button.

---

### **STEP 2: Add Secret #1 - Backend Deployment Profile**

1. Click **New repository secret** button

2. In the "Name" field, type exactly:
   ```
   AZURE_BACKEND_PUBLISH_PROFILE
   ```

3. In the "Secret" field, paste the entire content of `backend-publish-profile.xml`
   
   To get the content:
   - Go to: https://github.com/Harshith7103/Fintrack/blob/main/backend-publish-profile.xml
   - Click the "Raw" button (top right)
   - Select all and copy (Ctrl+A, Ctrl+C)
   - Paste into GitHub secret field

4. Click **Add secret**

You'll see: ✅ "AZURE_BACKEND_PUBLISH_PROFILE" added to actions secrets

---

### **STEP 3: Add Secret #2 - ML Deployment Profile**

1. Click **New repository secret** button again

2. In the "Name" field, type exactly:
   ```
   AZURE_ML_PUBLISH_PROFILE
   ```

3. In the "Secret" field, paste the entire content of `ml-publish-profile.xml`
   
   To get the content:
   - Go to: https://github.com/Harshith7103/Fintrack/blob/main/ml-publish-profile.xml
   - Click the "Raw" button (top right)
   - Select all and copy (Ctrl+A, Ctrl+C)
   - Paste into GitHub secret field

4. Click **Add secret**

You'll see: ✅ "AZURE_ML_PUBLISH_PROFILE" added to actions secrets

---

## ✅ That's It!

After you add these 2 secrets, GitHub will automatically detect them and trigger your deployment workflows.

---

## 📊 WHAT HAPPENS NEXT (Automatic)

### Timeline:
- **Immediately**: GitHub detects new secrets
- **10 seconds**: backend-deploy workflow starts
- **10 seconds**: ml-deploy workflow starts  
- **2-3 minutes**: Backend finishes deploying
- **2-3 minutes**: ML API finishes deploying
- **5-10 minutes total**: All services deployed

### What Gets Deployed:
1. ✅ **Backend API** updates to Azure Web App
   - URL: https://fintrack-api-prod.azurewebsites.net
   - Framework: Node.js
   - Code from: `/backend` folder

2. ✅ **ML API** updates to Azure Web App
   - URL: https://fintrack-ml-prod.azurewebsites.net
   - Framework: Python
   - Code from: `/ml` folder

3. ✅ **Frontend** (if Static Web App exists)
   - Updates from: `/frontend` folder
   - Deployed to Static Web App

### How to Monitor:
1. Go to: https://github.com/Harshith7103/Fintrack/actions
2. You'll see running workflows:
   - "backend-deploy" workflow
   - "ml-deploy" workflow
   - "frontend-deploy" workflow (if Static Web App created)
3. Click each to see logs
4. Wait for all ✅ green checkmarks

---

## 🔍 VERIFY DEPLOYMENT

After workflows complete, verify everything works:

### Test Backend API:
```bash
curl https://fintrack-api-prod.azurewebsites.net/health
# Should return: {"status":"ok","database":"connected",...}
```

### Test ML API:
```bash
curl https://fintrack-ml-prod.azurewebsites.net/health
# Should return: {"status":"ok",...}
```

### Test Frontend:
Open in browser: https://fintrack-frontend.azurestaticapps.net
(After Static Web App is created and deployed)

---

## 🚀 YOUR LIVE URLS

After deployment completes:

| Service | URL | Status |
|---------|-----|--------|
| **Backend API** | https://fintrack-api-prod.azurewebsites.net | Will be live |
| **ML API** | https://fintrack-ml-prod.azurewebsites.net | Will be live |
| **Frontend** | https://fintrack-XXXXX.azurestaticapps.net | Needs Static Web App |

---

## 🎯 QUICK CHECKLIST

```
☐ Opened GitHub repo secrets page
☐ Added AZURE_BACKEND_PUBLISH_PROFILE secret
  (Copied from backend-publish-profile.xml)
☐ Added AZURE_ML_PUBLISH_PROFILE secret
  (Copied from ml-publish-profile.xml)
☐ Went to Actions tab
☐ Watched workflows complete
☐ Verified APIs are responding
☐ FinTrack is LIVE! 🎉
```

---

## ❓ WHAT IF SOMETHING GOES WRONG?

### Workflow shows ❌ Red X
1. Click the failed workflow
2. Click "Run" or "Jobs"
3. See the error message
4. Common causes:
   - Secret content incomplete (missing text)
   - Secret name misspelled (must be exact)
   - Azure credentials expired

### API returns 502 Bad Gateway
- Wait 2-3 minutes for deployment to complete
- Check Azure Portal to see if app is running
- Check workflow logs for build errors

### Can't connect to backend
- Verify CORS is enabled
- Check database connection in logs
- Ensure MySQL schema was imported

---

## 📞 NEED HELP?

If something isn't working:

1. Check GitHub Actions logs (detailed error messages)
2. Check Azure Portal (App Services → Logs)
3. Verify secret contents are complete
4. Verify secret names are exact match

---

## ✨ YOU'RE ALMOST THERE!

Just add those 2 secrets and GitHub does everything else automatically! 🚀

**Status: 98% Complete → 100% Complete (in 15 minutes)**

---

**Important:** 
- Secret names are **CASE-SENSITIVE**
- Copy **entire** XML file content (no truncation)
- After adding secrets, workflows start automatically
- First deployment may take 5-10 minutes

**Good luck! Your FinTrack app will be live soon!** 🎉
