#!/bin/bash
# FinTrack Azure Deployment - Quick Setup Script
# Run this in Azure Cloud Shell after Static Web App is created

RESOURCE_GROUP="rg-fintrack-student"
MYSQL_SERVER="mysqlfintrack7844"
COSMOS_ACCOUNT="cosmosfintrack7844"
BACKEND_APP="fintrack-backend"
ML_APP="fintrack-ml"
STATIC_WEB_APP="fintrack-frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        FinTrack Azure Deployment - Final Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Step 1: Import MySQL Schema
echo -e "\n${YELLOW}Step 1: Importing MySQL schema...${NC}"
read -p "Enter MySQL password (FinTrack@Azure2024!): " MYSQL_PASSWORD

wget -q https://raw.githubusercontent.com/YOUR_GITHUB_ORG/YOUR_REPO/main/database/mysql/01_create_tables.sql -O /tmp/schema.sql

mysql -h "${MYSQL_SERVER}.mysql.database.azure.com" \
  -u fintrackadmin \
  -p"${MYSQL_PASSWORD}" \
  --ssl-mode=REQUIRED \
  fintrack_final < /tmp/schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MySQL schema imported${NC}"
else
    echo -e "${RED}❌ MySQL import failed${NC}"
fi

# Step 2: Get Static Web App URL
echo -e "\n${YELLOW}Step 2: Getting Static Web App URL...${NC}"
STATIC_APP_URL=$(az staticwebapp list --resource-group $RESOURCE_GROUP --query "[0].defaultHostname" -o tsv)
echo -e "${GREEN}Static Web App URL: $STATIC_APP_URL${NC}"

# Step 3: Update Backend with Static Web App URL
echo -e "\n${YELLOW}Step 3: Updating backend with Static Web App URL...${NC}"
az webapp config appsettings set \
    --name $BACKEND_APP \
    --resource-group $RESOURCE_GROUP \
    --settings FRONTEND_URL="https://${STATIC_APP_URL}" > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend updated${NC}"
fi

# Step 4: Get Publish Profiles for GitHub
echo -e "\n${YELLOW}Step 4: GitHub Secrets Setup${NC}"
echo -e "${BLUE}Add these to your GitHub repo Secrets:${NC}"

echo -e "\n${YELLOW}1. AZURE_BACKEND_PUBLISH_PROFILE:${NC}"
az webapp deployment list-publishing-profiles \
    --name $BACKEND_APP \
    --resource-group $RESOURCE_GROUP \
    --xml | head -5

echo -e "\n${YELLOW}2. AZURE_ML_PUBLISH_PROFILE:${NC}"
az webapp deployment list-publishing-profiles \
    --name $ML_APP \
    --resource-group $RESOURCE_GROUP \
    --xml | head -5

# Step 5: Test APIs
echo -e "\n${YELLOW}Step 5: Testing APIs...${NC}"
echo -e "\n${BLUE}Backend Health Check:${NC}"
curl -s "https://${BACKEND_APP}.azurewebsites.net/health" | jq . 2>/dev/null || echo "Endpoint starting..."

echo -e "\n${BLUE}ML Health Check:${NC}"
curl -s "https://${ML_APP}.azurewebsites.net/health" | jq . 2>/dev/null || echo "Endpoint starting..."

# Summary
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}         ✅ FinTrack Azure Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}Your Endpoints:${NC}"
echo -e "  Frontend:  https://${STATIC_APP_URL}"
echo -e "  Backend:   https://${BACKEND_APP}.azurewebsites.net"
echo -e "  ML API:    https://${ML_APP}.azurewebsites.net"

echo -e "\n${BLUE}Databases:${NC}"
echo -e "  MySQL:     ${MYSQL_SERVER}.mysql.database.azure.com"
echo -e "  Cosmos DB: ${COSMOS_ACCOUNT}.documents.azure.com"

echo -e "\n${BLUE}Next: Push to GitHub to trigger auto-deployments!${NC}\n"
