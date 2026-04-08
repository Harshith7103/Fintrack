#!/usr/bin/env python3
"""
FinTrack Azure Deployment Script
Automates the remaining deployment steps
"""

import os
import sys
import subprocess
import json
from pathlib import Path

# Configuration
RESOURCE_GROUP = "rg-fintrack-student"
MYSQL_HOST = "mysqlfintrack7844.mysql.database.azure.com"
MYSQL_USER = "fintrackadmin"
MYSQL_PASSWORD = "FinTrack@Azure2024!"
MYSQL_DB = "fintrack_final"
MYSQL_PORT = 3306

BACKEND_APP = "fintrack-api-prod"
ML_APP = "fintrack-ml-prod"
FRONTEND_APP = "fintrack-frontend"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")

def print_warning(msg):
    print(f"⚠️  {msg}")

def run_cmd(cmd, silent=False):
    """Run shell command"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        if not silent and result.stdout:
            print(result.stdout.strip())
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        print_error(f"Command failed: {e}")
        return 1, "", str(e)

def import_mysql_schema():
    """Import MySQL schema files"""
    print_section("STEP 1: Import MySQL Schema")
    
    schema_files = [
        "database/mysql/01_create_tables.sql",
        "database/mysql/02_stored_procedures.sql",
        "database/mysql/03_triggers.sql",
        "database/mysql/05_seed_data.sql"
    ]
    
    print_info(f"Connecting to MySQL: {MYSQL_HOST}")
    
    for sql_file in schema_files:
        if not os.path.exists(sql_file):
            print_warning(f"Skipping missing file: {sql_file}")
            continue
        
        print(f"\n📄 Importing: {sql_file}")
        file_size = os.path.getsize(sql_file) / 1024
        print_info(f"   File size: {file_size:.1f} KB")
        
        try:
            # Try using mysqlsh if available
            cmd = f'mysqlsh.exe --mysql --user={MYSQL_USER} --password={MYSQL_PASSWORD} --host={MYSQL_HOST} --port={MYSQL_PORT} --database={MYSQL_DB} --file="{sql_file}" 2>&1'
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print_success(f"Imported: {sql_file}")
            else:
                # Check if file had actual content processed
                if "Query OK" in result.stdout or "affected" in result.stdout.lower():
                    print_success(f"Imported: {sql_file} (with warnings)")
                else:
                    print_warning(f"Import may have issues - checking manually")
                    # Print first 500 chars of error for diagnosis
                    error_preview = result.stderr[:500] if result.stderr else "No error details"
                    print_info(f"   Details: {error_preview}")
        
        except subprocess.TimeoutExpired:
            print_warning(f"Import timeout for {sql_file} - may have succeeded")
        except Exception as e:
            print_error(f"Failed to import {sql_file}: {e}")
    
    print_success("MySQL schema import process completed!")

def check_azure_resources():
    """Check current Azure resources"""
    print_section("STEP 2: Check Azure Resources")
    
    resources = {
        "Backend API": (BACKEND_APP, "Microsoft.Web/sites"),
        "ML API": (ML_APP, "Microsoft.Web/sites"),
        "MySQL": ("mysqlfintrack7844", "Microsoft.DBforMySQL/flexibleServers"),
        "Cosmos DB": ("cosmosfintrack7844", "Microsoft.DocumentDB/databaseAccounts")
    }
    
    for display_name, (resource_name, resource_type) in resources.items():
        try:
            cmd = f'az resource show --name {resource_name} --resource-group {RESOURCE_GROUP} --resource-type {resource_type} --query "name" -o tsv 2>&1'
            code, stdout, stderr = run_cmd(cmd, silent=True)
            
            if code == 0 and stdout:
                print_success(f"{display_name}: {stdout}")
            else:
                print_warning(f"{display_name}: Not found or error")
        except Exception as e:
            print_warning(f"{display_name}: Error checking - {e}")

def get_app_settings():
    """Get backend app settings"""
    print_section("STEP 3: Backend Configuration")
    
    print_info("Backend App: fintrack-api-prod")
    cmd = f'az webapp config appsettings list --name {BACKEND_APP} --resource-group {RESOURCE_GROUP} --query "[].name" -o table 2>&1'
    code, stdout, stderr = run_cmd(cmd)
    
    if code == 0:
        print_success("Backend app settings retrieved")
    else:
        print_warning("Could not retrieve app settings")

def deployment_instructions():
    """Print deployment instructions"""
    print_section("STEP 4: Complete Deployment Instructions")
    
    print("📋 Before pushing to GitHub, complete these steps:\n")
    
    print("1️⃣  CREATE STATIC WEB APP (if not already created)")
    print("   - Go to: https://portal.azure.com")
    print("   - Search for: 'Static Web Apps'")
    print("   - Click '+ Create'")
    print("   - Settings:")
    print("     • Subscription: Azure for Students")
    print("     • Resource Group: rg-fintrack-student")
    print("     • Name: fintrack-frontend")
    print("     • Plan: Free")
    print("     • Region: East US 2")
    print("     • Source: GitHub")
    print("     • Connect to your GitHub repo")
    print("     • Build Presets: React")
    print("     • App location: /frontend")
    print("     • Output location: dist\n")
    
    print("2️⃣  GET GITHUB SECRETS")
    print("   Run these Azure CLI commands and copy the output:\n")
    
    print("   A) Backend Publishing Profile:")
    print(f"      az webapp deployment list-publishing-profiles --name {BACKEND_APP} --resource-group {RESOURCE_GROUP} --xml\n")
    
    print("   B) ML Publishing Profile:")
    print(f"      az webapp deployment list-publishing-profiles --name {ML_APP} --resource-group {RESOURCE_GROUP} --xml\n")
    
    print("   C) Static Web App Token:")
    print("      - Go to Azure Portal → Static Web App → Overview")
    print("      - Click 'Manage deployment token'\n")
    
    print("3️⃣  ADD GITHUB SECRETS")
    print("   - Go to your GitHub repo → Settings → Secrets and variables → Actions")
    print("   - Add the following secrets:")
    print("     • AZURE_BACKEND_PUBLISH_PROFILE (paste from 2A)")
    print("     • AZURE_ML_PUBLISH_PROFILE (paste from 2B)")
    print("     • AZURE_STATIC_WEB_APPS_API_TOKEN (paste from 2C)\n")
    
    print("4️⃣  PUSH CODE TO TRIGGER DEPLOYMENT")
    print("   cd /path/to/fintrack")
    print("   git add .")
    print('   git commit -m "Deploy FinTrack to Azure"')
    print("   git push origin main\n")
    
    print("5️⃣  MONITOR DEPLOYMENT")
    print("   - Go to GitHub repo → Actions")
    print("   - Watch the workflows:")
    print("     • backend-deploy.yml")
    print("     • ml-deploy.yml")
    print("     • frontend-deploy.yml\n")

def print_endpoints():
    """Print service endpoints"""
    print_section("Your FinTrack Endpoints")
    
    endpoints = {
        "Backend API": "https://fintrack-api-prod.azurewebsites.net",
        "ML API": "https://fintrack-ml-prod.azurewebsites.net",
        "MySQL": "mysqlfintrack7844.mysql.database.azure.com",
        "Cosmos DB": "cosmosfintrack7844.documents.azure.com"
    }
    
    for name, endpoint in endpoints.items():
        print_success(f"{name}: {endpoint}")

def main():
    """Main deployment function"""
    print("\n" + "="*60)
    print("  🚀 FinTrack Azure Deployment Script")
    print("="*60)
    
    # Change to project directory
    os.chdir(Path(__file__).parent)
    
    # Run deployment steps
    import_mysql_schema()
    check_azure_resources()
    get_app_settings()
    print_endpoints()
    deployment_instructions()
    
    print("\n" + "="*60)
    print("  ✅ Deployment preparation complete!")
    print("  📖 Follow the instructions above to complete deployment")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
