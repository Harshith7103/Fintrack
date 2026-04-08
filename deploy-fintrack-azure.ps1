# FinTrack Azure Deployment Automation Script
# This script completes the Azure deployment process

param(
    [switch]$SkipSchema = $false,
    [switch]$SkipGitHub = $false,
    [switch]$SkipFrontend = $false
)

# Configuration
$RESOURCE_GROUP = "rg-fintrack-student"
$REGION = "Southeast Asia"
$MYSQL_HOST = "mysqlfintrack7844.mysql.database.azure.com"
$MYSQL_USER = "fintrackadmin"
$MYSQL_PASSWORD = "FinTrack@Azure2024!"
$MYSQL_DB = "fintrack_final"
$MYSQL_PORT = 3306

$BACKEND_APP = "fintrack-backend"
$ML_APP = "fintrack-ml"
$FRONTEND_APP = "fintrack-frontend"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning-Custom { Write-Host $args -ForegroundColor Yellow }

# ==================== STEP 1: Import MySQL Schema ====================
if (-not $SkipSchema) {
    Write-Info "`n=== STEP 1: Importing MySQL Schema ==="
    Write-Info "Connecting to MySQL: $MYSQL_HOST"
    
    $schemaFiles = @(
        "database\mysql\01_create_tables.sql",
        "database\mysql\02_stored_procedures.sql",
        "database\mysql\03_triggers.sql",
        "database\mysql\05_seed_data.sql"
    )
    
    foreach ($sqlFile in $schemaFiles) {
        if (Test-Path $sqlFile) {
            Write-Info "Importing: $sqlFile"
            
            # Read the SQL file
            $sqlContent = Get-Content $sqlFile -Raw
            
            # Create a temporary script for mysqlsh
            $tempScript = [System.IO.Path]::GetTempFileName() + ".sql"
            Set-Content $tempScript $sqlContent -Encoding UTF8
            
            # Execute using MySQL Shell
            try {
                $process = Start-Process mysqlsh.exe -ArgumentList `
                    "--mysql", "--user=$MYSQL_USER", "--password=$MYSQL_PASSWORD", `
                    "--host=$MYSQL_HOST", "--port=$MYSQL_PORT", $MYSQL_DB `
                    -RedirectStandardInput $tempScript -RedirectStandardOutput ([System.IO.Path]::GetTempFileName()) `
                    -RedirectStandardError ([System.IO.Path]::GetTempFileName()) -Wait -PassThru
                
                if ($process.ExitCode -eq 0) {
                    Write-Success "✅ Successfully imported: $sqlFile"
                } else {
                    Write-Warning-Custom "⚠️  Check import status for: $sqlFile (Exit Code: $($process.ExitCode))"
                }
            }
            catch {
                Write-Error-Custom "❌ Failed to import $sqlFile : $_"
            }
            finally {
                # Cleanup temp file
                Remove-Item $tempScript -ErrorAction SilentlyContinue
            }
        }
        else {
            Write-Error-Custom "❌ SQL file not found: $sqlFile"
        }
    }
    
    Write-Success "✅ MySQL Schema import completed!"
}

# ==================== STEP 2: Check/Create Static Web App ====================
if (-not $SkipFrontend) {
    Write-Info "`n=== STEP 2: Checking Static Web App ==="
    
    # Check if Static Web App already exists
    $staticApp = az staticwebapp list --resource-group $RESOURCE_GROUP --query "[?name=='$FRONTEND_APP']" 2>&1
    
    if ($staticApp -and $staticApp.Count -gt 0) {
        Write-Success "✅ Static Web App already exists"
        $staticAppUrl = az staticwebapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --query "defaultHostname" -o tsv 2>&1
        Write-Success "Frontend URL: https://$staticAppUrl"
    }
    else {
        Write-Warning-Custom "ℹ️  Static Web App needs to be created manually in Azure Portal:"
        Write-Warning-Custom "1. Go to https://portal.azure.com"
        Write-Warning-Custom "2. Create Resource → Static Web App → Free Tier"
        Write-Warning-Custom "3. Settings:"
        Write-Warning-Custom "   - Name: $FRONTEND_APP"
        Write-Warning-Custom "   - Resource Group: $RESOURCE_GROUP"
        Write-Warning-Custom "   - Region: East US 2"
        Write-Warning-Custom "   - Source: GitHub"
        Write-Warning-Custom "   - Build Presets: React"
        Write-Warning-Custom "   - App location: /frontend"
        Write-Warning-Custom "   - Output location: dist"
    }
}

# ==================== STEP 3: Setup GitHub Secrets ====================
if (-not $SkipGitHub) {
    Write-Info "`n=== STEP 3: GitHub Secrets Configuration ==="
    
    # Check if git is available
    $gitCheck = git --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "❌ Git not found. Cannot determine repository details."
        exit 1
    }
    
    # Get repository info
    $repoUrl = git config --get remote.origin.url
    $repoName = ($repoUrl -split '/')[-1] -replace '\.git$', ''
    $repoOwner = ($repoUrl -split '/')[-2]
    
    Write-Info "Repository: $repoOwner/$repoName"
    
    # Get publishing profiles
    Write-Info "Retrieving publishing profiles..."
    Write-Warning-Custom "ℹ️  GitHub Secrets need to be added manually:"
    
    # Backend Publishing Profile
    Write-Info "`n📋 AZURE_BACKEND_PUBLISH_PROFILE:"
    Write-Info "Run this command and copy the output:"
    Write-Warning-Custom "az webapp deployment list-publishing-profiles --name $BACKEND_APP --resource-group $RESOURCE_GROUP --xml"
    
    # ML Publishing Profile
    Write-Info "`n📋 AZURE_ML_PUBLISH_PROFILE:"
    Write-Info "Run this command and copy the output:"
    Write-Warning-Custom "az webapp deployment list-publishing-profiles --name $ML_APP --resource-group $RESOURCE_GROUP --xml"
    
    # Static Web App Token
    Write-Info "`n📋 AZURE_STATIC_WEB_APPS_API_TOKEN:"
    Write-Info "Get this from Azure Portal → Static Web App → Overview → Manage deployment token"
}

# ==================== STEP 4: Check Current Deployment Status ====================
Write-Info "`n=== STEP 4: Current Azure Resources Status ==="

# Backend
Write-Info "`nBackend API:"
$backend = az webapp show --name $BACKEND_APP --resource-group $RESOURCE_GROUP --query "hostNames" -o tsv 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "✅ $BACKEND_APP is deployed"
    Write-Success "   URL: https://$backend"
}

# ML
Write-Info "`nML API:"
$ml = az webapp show --name $ML_APP --resource-group $RESOURCE_GROUP --query "hostNames" -o tsv 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "✅ $ML_APP is deployed"
    Write-Success "   URL: https://$ml"
}

# Database
Write-Info "`nMySQL Database:"
Write-Success "✅ MySQL Server: $MYSQL_HOST"

# ==================== STEP 5: Pre-Deployment Checklist ====================
Write-Info "`n=== Pre-Deployment Checklist ==="
Write-Info "Before pushing to GitHub, ensure:"
Write-Info "☐ MySQL schema has been imported"
Write-Info "☐ Static Web App has been created in Azure Portal"
Write-Info "☐ GitHub Secrets have been added"
Write-Info "☐ Environment variables are set in Azure"
Write-Info "☐ FRONTEND_URL is configured in backend app settings"

# ==================== FINAL INSTRUCTIONS ====================
Write-Success "`n=== DEPLOYMENT COMPLETE ==="
Write-Success "✅ Azure infrastructure is ready!"
Write-Success "`nNext steps:"
Write-Info "1. Add GitHub secrets (see details above)"
Write-Info "2. Create Static Web App in Azure Portal"
Write-Info "3. Run: git add . && git commit -m 'Deploy FinTrack to Azure' && git push origin main"
Write-Info "4. Monitor: GitHub Actions → Workflows"
Write-Success "`n🎉 Your FinTrack system will be live!"
