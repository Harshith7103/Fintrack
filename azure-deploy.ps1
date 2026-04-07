# FinTrack Azure Deployment Script
# Run this in Azure Cloud Shell (PowerShell) or local PowerShell with Azure CLI installed
# Optimized for Azure for Students account

# ==================== CONFIGURATION ====================
$RESOURCE_GROUP = "rg-fintrack-student"
$LOCATION = "eastus"
$KEY_VAULT_NAME = "kv-fintrack-$(Get-Random -Maximum 9999)"  # Must be globally unique
$MYSQL_SERVER = "mysql-fintrack-$(Get-Random -Maximum 9999)"  # Must be globally unique
$COSMOS_ACCOUNT = "cosmos-fintrack-$(Get-Random -Maximum 9999)"  # Must be globally unique
$APP_PLAN = "plan-fintrack-student"
$BACKEND_APP = "fintrack-backend-$(Get-Random -Maximum 9999)"  # Must be globally unique
$ML_APP = "fintrack-ml-$(Get-Random -Maximum 9999)"  # Must be globally unique

# Database credentials (CHANGE THESE!)
$MYSQL_ADMIN_USER = "fintrackadmin"
$MYSQL_ADMIN_PASSWORD = "FinTrack@Azure2024!"  # Change this to a secure password!

# ==================== STEP 1: CREATE RESOURCE GROUP ====================
Write-Host "`n📦 Step 1: Creating Resource Group..." -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION

# ==================== STEP 2: CREATE KEY VAULT ====================
Write-Host "`n🔐 Step 2: Creating Key Vault..." -ForegroundColor Cyan
az keyvault create `
    --name $KEY_VAULT_NAME `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --sku standard

# ==================== STEP 3: CREATE MYSQL FLEXIBLE SERVER ====================
Write-Host "`n🗄️ Step 3: Creating MySQL Flexible Server (B1ms - Free 12 months)..." -ForegroundColor Cyan
az mysql flexible-server create `
    --resource-group $RESOURCE_GROUP `
    --name $MYSQL_SERVER `
    --location $LOCATION `
    --admin-user $MYSQL_ADMIN_USER `
    --admin-password $MYSQL_ADMIN_PASSWORD `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --storage-size 20 `
    --version 8.0.21 `
    --public-access 0.0.0.0

# Create database
Write-Host "   Creating fintrack_final database..." -ForegroundColor Yellow
az mysql flexible-server db create `
    --resource-group $RESOURCE_GROUP `
    --server-name $MYSQL_SERVER `
    --database-name fintrack_final

# ==================== STEP 4: CREATE COSMOS DB ====================
Write-Host "`n🌍 Step 4: Creating Cosmos DB with MongoDB API (Free Tier)..." -ForegroundColor Cyan
az cosmosdb create `
    --name $COSMOS_ACCOUNT `
    --resource-group $RESOURCE_GROUP `
    --kind MongoDB `
    --server-version 4.2 `
    --enable-free-tier true `
    --default-consistency-level Session `
    --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=false

# Create MongoDB database
Write-Host "   Creating fintrack MongoDB database..." -ForegroundColor Yellow
az cosmosdb mongodb database create `
    --account-name $COSMOS_ACCOUNT `
    --resource-group $RESOURCE_GROUP `
    --name fintrack

# ==================== STEP 5: CREATE APP SERVICE PLAN ====================
Write-Host "`n📋 Step 5: Creating App Service Plan (F1 Free Tier)..." -ForegroundColor Cyan
az appservice plan create `
    --name $APP_PLAN `
    --resource-group $RESOURCE_GROUP `
    --is-linux `
    --sku F1

# ==================== STEP 6: CREATE BACKEND APP SERVICE ====================
Write-Host "`n🖥️ Step 6: Creating Backend App Service (Node.js 20)..." -ForegroundColor Cyan
az webapp create `
    --name $BACKEND_APP `
    --resource-group $RESOURCE_GROUP `
    --plan $APP_PLAN `
    --runtime "NODE:20-lts"

# Enable managed identity for Key Vault access
az webapp identity assign `
    --name $BACKEND_APP `
    --resource-group $RESOURCE_GROUP

# ==================== STEP 7: CREATE ML APP SERVICE ====================
Write-Host "`n🤖 Step 7: Creating ML App Service (Python 3.11)..." -ForegroundColor Cyan
az webapp create `
    --name $ML_APP `
    --resource-group $RESOURCE_GROUP `
    --plan $APP_PLAN `
    --runtime "PYTHON:3.11"

# Set startup command for FastAPI
az webapp config set `
    --name $ML_APP `
    --resource-group $RESOURCE_GROUP `
    --startup-file "gunicorn -w 2 -k uvicorn.workers.UvicornWorker api:app --bind 0.0.0.0:8000"

# ==================== STEP 8: GET CONNECTION STRINGS ====================
Write-Host "`n🔑 Step 8: Retrieving Connection Strings..." -ForegroundColor Cyan

# Get Cosmos DB connection string
$COSMOS_CONN = az cosmosdb keys list `
    --name $COSMOS_ACCOUNT `
    --resource-group $RESOURCE_GROUP `
    --type connection-strings `
    --query "connectionStrings[0].connectionString" `
    --output tsv

# ==================== STEP 9: STORE SECRETS IN KEY VAULT ====================
Write-Host "`n🔒 Step 9: Storing Secrets in Key Vault..." -ForegroundColor Cyan
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "mysql-password" --value $MYSQL_ADMIN_PASSWORD
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "cosmos-connection-string" --value $COSMOS_CONN

# Grant Backend App access to Key Vault
$BACKEND_PRINCIPAL = az webapp identity show `
    --name $BACKEND_APP `
    --resource-group $RESOURCE_GROUP `
    --query principalId `
    --output tsv

az keyvault set-policy `
    --name $KEY_VAULT_NAME `
    --object-id $BACKEND_PRINCIPAL `
    --secret-permissions get list

# ==================== STEP 10: CONFIGURE BACKEND ENVIRONMENT VARIABLES ====================
Write-Host "`n⚙️ Step 10: Configuring Backend Environment Variables..." -ForegroundColor Cyan
az webapp config appsettings set `
    --name $BACKEND_APP `
    --resource-group $RESOURCE_GROUP `
    --settings `
        DB_HOST="$MYSQL_SERVER.mysql.database.azure.com" `
        DB_USER=$MYSQL_ADMIN_USER `
        DB_PASSWORD=$MYSQL_ADMIN_PASSWORD `
        DB_NAME="fintrack_final" `
        DB_PORT="3306" `
        DB_SSL="true" `
        MONGO_URI=$COSMOS_CONN `
        ML_API_URL="https://$ML_APP.azurewebsites.net" `
        NODE_ENV="production" `
        WEBSITE_NODE_DEFAULT_VERSION="~20"

# ==================== STEP 11: CONFIGURE ML ENVIRONMENT VARIABLES ====================
Write-Host "`n⚙️ Step 11: Configuring ML Environment Variables..." -ForegroundColor Cyan
az webapp config appsettings set `
    --name $ML_APP `
    --resource-group $RESOURCE_GROUP `
    --settings `
        WEBSITES_PORT="8000" `
        SCM_DO_BUILD_DURING_DEPLOYMENT="true"

# ==================== STEP 12: CREATE APPLICATION INSIGHTS ====================
Write-Host "`n📊 Step 12: Creating Application Insights..." -ForegroundColor Cyan
az monitor app-insights component create `
    --app "appinsights-fintrack" `
    --location $LOCATION `
    --resource-group $RESOURCE_GROUP `
    --application-type web

$APP_INSIGHTS_KEY = az monitor app-insights component show `
    --app "appinsights-fintrack" `
    --resource-group $RESOURCE_GROUP `
    --query instrumentationKey `
    --output tsv

# Add App Insights to Backend
az webapp config appsettings set `
    --name $BACKEND_APP `
    --resource-group $RESOURCE_GROUP `
    --settings APPINSIGHTS_INSTRUMENTATIONKEY=$APP_INSIGHTS_KEY

# ==================== DEPLOYMENT SUMMARY ====================
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ FINTRACK AZURE DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 RESOURCE NAMES (Save these!):" -ForegroundColor Yellow
Write-Host "   Resource Group:    $RESOURCE_GROUP"
Write-Host "   Key Vault:         $KEY_VAULT_NAME"
Write-Host "   MySQL Server:      $MYSQL_SERVER"
Write-Host "   Cosmos DB:         $COSMOS_ACCOUNT"
Write-Host "   Backend App:       $BACKEND_APP"
Write-Host "   ML App:            $ML_APP"
Write-Host ""
Write-Host "🌐 ENDPOINTS:" -ForegroundColor Yellow
Write-Host "   Backend API:       https://$BACKEND_APP.azurewebsites.net"
Write-Host "   ML API:            https://$ML_APP.azurewebsites.net"
Write-Host "   MySQL Host:        $MYSQL_SERVER.mysql.database.azure.com"
Write-Host ""
Write-Host "🔐 CREDENTIALS:" -ForegroundColor Yellow
Write-Host "   MySQL User:        $MYSQL_ADMIN_USER"
Write-Host "   MySQL Password:    (stored in Key Vault: $KEY_VAULT_NAME)"
Write-Host ""
Write-Host "📝 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Create Static Web App for Frontend (Azure Portal recommended)"
Write-Host "   2. Add GitHub secrets for CI/CD"
Write-Host "   3. Import your MySQL schema to Azure"
Write-Host "   4. Push code to trigger deployments"
Write-Host ""
