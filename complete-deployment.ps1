# FinTrack Azure Deployment - Automated Setup
# This script automates as much as possible of the remaining deployment steps

param(
    [switch]$SkipStatic = $false
)

Write-Host "`n╔════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  FinTrack Azure Deployment - Final Automation Script                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$RESOURCE_GROUP = "rg-fintrack-student"
$REGION = "eastus2"
$FRONTEND_APP = "fintrack-frontend"
$REPO_OWNER = "YOUR_GITHUB_USERNAME"
$REPO_NAME = "YOUR_REPO_NAME"

function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error-Msg { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning-Msg { Write-Host "⚠️  $args" -ForegroundColor Yellow }

# Step 1: Check credentials files
Write-Host "`n📁 Step 1: Checking credential files...`n" -ForegroundColor Yellow

if (Test-Path "backend-publish-profile.xml") {
    Write-Success "backend-publish-profile.xml found"
} else {
    Write-Error-Msg "backend-publish-profile.xml not found"
    exit 1
}

if (Test-Path "ml-publish-profile.xml") {
    Write-Success "ml-publish-profile.xml found"
} else {
    Write-Error-Msg "ml-publish-profile.xml not found"
    exit 1
}

# Step 2: Create Static Web App (if not skipped)
if (-not $SkipStatic) {
    Write-Host "`n⚠️  Step 2: Static Web App Creation`n" -ForegroundColor Yellow
    
    $existing = az staticwebapp list --resource-group $RESOURCE_GROUP --query "[?name=='$FRONTEND_APP']" 2>&1
    
    if ($existing -and $existing.Count -gt 0) {
        Write-Success "Static Web App already exists"
        $swapp = az staticwebapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --query "defaultHostname" -o tsv 2>&1
        Write-Success "Frontend URL: https://$swapp"
    }
    else {
        Write-Info "Static Web App creation requires GitHub authentication"
        Write-Info "You must create it manually via Azure Portal:"
        Write-Info "  1. Go to: https://portal.azure.com/#create/Microsoft.StaticWebApp"
        Write-Info "  2. Fill in settings:"
        Write-Info "     - Name: fintrack-frontend"
        Write-Info "     - Resource Group: rg-fintrack-student"
        Write-Info "     - Region: East US 2"
        Write-Info "     - Source: GitHub (your repo)"
        Write-Info "     - Build: React"
        Write-Info "     - App location: /frontend"
        Write-Info "     - Output: dist"
        Write-Info "  3. Save your frontend URL after creation"
    }
}

# Step 3: Display secrets for GitHub
Write-Host "`n📝 Step 3: GitHub Secrets Configuration`n" -ForegroundColor Yellow

$backendProfile = Get-Content "backend-publish-profile.xml" -Raw
$mlProfile = Get-Content "ml-publish-profile.xml" -Raw

Write-Info "Add these secrets to GitHub → Settings → Secrets and variables → Actions:"
Write-Host "`n" + ("="*80) + "`n" -ForegroundColor Gray

Write-Host "🔑 Secret 1: AZURE_BACKEND_PUBLISH_PROFILE" -ForegroundColor Cyan
Write-Host "Content (first 100 chars): $($backendProfile.Substring(0, 100))..." -ForegroundColor Gray
Write-Host "Full content: ./backend-publish-profile.xml`n" -ForegroundColor Gray

Write-Host "🔑 Secret 2: AZURE_ML_PUBLISH_PROFILE" -ForegroundColor Cyan
Write-Host "Content (first 100 chars): $($mlProfile.Substring(0, 100))..." -ForegroundColor Gray
Write-Host "Full content: ./ml-publish-profile.xml`n" -ForegroundColor Gray

Write-Host "🔑 Secret 3: AZURE_STATIC_WEB_APPS_API_TOKEN" -ForegroundColor Cyan
Write-Host "Get from: Azure Portal → Static Web App → Overview → Manage deployment token`n" -ForegroundColor Gray

Write-Host "📝 Variable: VITE_API_URL" -ForegroundColor Cyan
Write-Host "Value: https://fintrack-api-prod.azurewebsites.net`n" -ForegroundColor Gray

# Step 4: Instructions for deployment
Write-Host "════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor Gray

Write-Host "`n✨ Step 4: Final Deployment`n" -ForegroundColor Yellow

Write-Info "After adding secrets to GitHub:"
Write-Info "1. Make sure your code is committed"
Write-Info "2. Push to main branch:"
Write-Host "`n   git add .`n   git commit -m 'Deploy FinTrack to Azure'`n   git push origin main`n" -ForegroundColor Green

Write-Info "3. Monitor deployments:"
Write-Info "   GitHub repo → Actions tab"
Write-Info "   Watch these workflows:"
Write-Info "     • backend-deploy.yml"
Write-Info "     • ml-deploy.yml"
Write-Info "     • frontend-deploy.yml"

# Summary
Write-Host "`n════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor Gray

Write-Host "📋 DEPLOYMENT CHECKLIST:`n" -ForegroundColor Cyan

Write-Info "□ Created Static Web App (manual, if needed)"
Write-Info "□ Added AZURE_BACKEND_PUBLISH_PROFILE to GitHub"
Write-Info "□ Added AZURE_ML_PUBLISH_PROFILE to GitHub"
Write-Info "□ Added AZURE_STATIC_WEB_APPS_API_TOKEN to GitHub"
Write-Info "□ Added VITE_API_URL variable to GitHub"
Write-Info "□ Committed and pushed code to main branch"
Write-Info "□ All 3 GitHub Actions workflows completed successfully"

Write-Host "`n🎉 Then your FinTrack app will be live!`n" -ForegroundColor Green

Write-Host "════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor Gray
