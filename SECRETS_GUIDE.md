# 🎯 EXACT SECRETS YOU NEED TO CREATE

## 📍 WHERE ARE THE XML FILES?

Your XML files are on GitHub in your repository:

### File #1: Backend Deployment Profile
**Location:** https://github.com/Harshith7103/Fintrack/blob/main/backend-publish-profile.xml

**Contains:**
```xml
<publishData>
  <publishProfile profileName="fintrack-api-prod - Web Deploy" ...>
    <!-- Azure deployment credentials for backend -->
  </publishProfile>
  ...
</publishData>
```

### File #2: ML Deployment Profile
**Location:** https://github.com/Harshith7103/Fintrack/blob/main/ml-publish-profile.xml

**Contains:**
```xml
<publishData>
  <publishProfile profileName="fintrack-ml-prod - Web Deploy" ...>
    <!-- Azure deployment credentials for ML -->
  </publishProfile>
  ...
</publishData>
```

---

## 🔐 SECRETS YOU NEED TO CREATE

### SECRET #1 - Backend Deployment

**Exact Name:** `AZURE_BACKEND_PUBLISH_PROFILE` (copy exactly as written)

**What to Put in Value:**
- Go to: https://github.com/Harshith7103/Fintrack/blob/main/backend-publish-profile.xml
- Click the "Raw" button (top right of the file)
- Select all text (Ctrl+A)
- Copy it (Ctrl+C)
- Paste into GitHub secret

### SECRET #2 - ML Deployment

**Exact Name:** `AZURE_ML_PUBLISH_PROFILE` (copy exactly as written)

**What to Put in Value:**
- Go to: https://github.com/Harshith7103/Fintrack/blob/main/ml-publish-profile.xml
- Click the "Raw" button (top right of the file)
- Select all text (Ctrl+A)
- Copy it (Ctrl+C)
- Paste into GitHub secret

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### STEP 1: Go to Secrets Page
```
https://github.com/Harshith7103/Fintrack/settings/secrets/actions
```

### STEP 2: Add Secret #1 (Backend)

1. Click **"New repository secret"**
2. In Name field type: `AZURE_BACKEND_PUBLISH_PROFILE`
3. In Secret field paste the content from backend-publish-profile.xml
4. Click **"Add secret"**

### STEP 3: Add Secret #2 (ML)

1. Click **"New repository secret"**
2. In Name field type: `AZURE_ML_PUBLISH_PROFILE`
3. In Secret field paste the content from ml-publish-profile.xml
4. Click **"Add secret"**

### STEP 4: Done!

GitHub will automatically start deploying your code.

---

## ✨ WHAT THESE SECRETS CONTAIN

### Backend XML Contains:
- Backend App Service name: `fintrack-api-prod`
- Deployment username
- Deployment password
- Deployment URL
- Deployment method (MSDeploy, FTP, ZipDeploy)

### ML XML Contains:
- ML App Service name: `fintrack-ml-prod`
- Deployment username
- Deployment password
- Deployment URL
- Deployment method (MSDeploy, FTP, ZipDeploy)

---

## 🔄 WHAT HAPPENS AFTER YOU ADD SECRETS

**Timeline:**

- **10 seconds**: GitHub detects new secrets
- **30 seconds**: Triggers backend-deploy workflow
- **30 seconds**: Triggers ml-deploy workflow
- **2-3 minutes**: Backend deploys to Azure
- **2-3 minutes**: ML deploys to Azure
- **5-10 minutes**: Everything is LIVE!

---

## 🔗 IMPORTANT LINKS

| What | URL |
|------|-----|
| GitHub Secrets Page | https://github.com/Harshith7103/Fintrack/settings/secrets/actions |
| Backend XML File | https://github.com/Harshith7103/Fintrack/blob/main/backend-publish-profile.xml |
| ML XML File | https://github.com/Harshith7103/Fintrack/blob/main/ml-publish-profile.xml |
| Monitor Deployment | https://github.com/Harshith7103/Fintrack/actions |

---

## ⚠️ IMPORTANT NOTES

1. **Secret names are CASE-SENSITIVE**
   - `AZURE_BACKEND_PUBLISH_PROFILE` ✅
   - `Azure_Backend_Publish_Profile` ❌
   - `azure_backend_publish_profile` ❌

2. **Copy the ENTIRE XML content**
   - Don't cut off or shorten it
   - Include all the `<publishData>` tags
   - Include all the `<publishProfile>` sections

3. **GitHub encrypts secrets**
   - Never shown in logs
   - Never displayed in UI
   - Only used by workflows
   - Safe to store

4. **The XML files are already in your repo**
   - You don't need to create them
   - Just copy their content to GitHub secrets

---

## 🎯 QUICK COPY-PASTE CHECKLIST

```
SECRET #1:
  Name: AZURE_BACKEND_PUBLISH_PROFILE
  Value: (copy from backend-publish-profile.xml)

SECRET #2:
  Name: AZURE_ML_PUBLISH_PROFILE
  Value: (copy from ml-publish-profile.xml)
```

---

## ✅ AFTER YOU'RE DONE

1. Go to: https://github.com/Harshith7103/Fintrack/actions
2. Wait for workflows to complete (green checkmarks)
3. Your app is LIVE!
4. Test at:
   - https://fintrack-api-prod.azurewebsites.net
   - https://fintrack-ml-prod.azurewebsites.net

---

**That's everything you need to know to add the secrets!** 🚀
