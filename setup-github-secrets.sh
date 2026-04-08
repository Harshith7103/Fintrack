#!/bin/bash

# FinTrack GitHub Secrets Setup Script
# Run this script to automatically add secrets to your GitHub repository

set -e

REPO_OWNER=""
REPO_NAME=""

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║  GitHub Secrets Setup - FinTrack Azure Deployment                         ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install from: https://cli.github.com/"
    echo "   Or install via: brew install gh (macOS) or choco install gh (Windows)"
    exit 1
fi

# Check if authenticated
echo "🔐 Checking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "   Run: gh auth login"
    exit 1
fi
echo "✅ GitHub CLI authenticated"
echo ""

# Get repo info
echo "📝 Getting repository information..."
REPO_URL=$(git config --get remote.origin.url)

if [ -z "$REPO_URL" ]; then
    echo "❌ Not in a git repository with remote configured"
    exit 1
fi

# Extract owner and repo name
REPO_OWNER=$(echo "$REPO_URL" | grep -oP '(?<=github\.com/)[^/]+' || echo "")
REPO_NAME=$(echo "$REPO_URL" | grep -oP '(?<=/)[^/]+?(?=\.git|$)' || echo "")

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo "❌ Could not parse repository URL: $REPO_URL"
    exit 1
fi

echo "Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Add secrets
echo "🔑 Adding secrets to GitHub..."
echo ""

# Backend Publishing Profile
if [ -f "backend-publish-profile.xml" ]; then
    echo "Adding AZURE_BACKEND_PUBLISH_PROFILE..."
    BACKEND_PROFILE=$(cat backend-publish-profile.xml)
    echo "$BACKEND_PROFILE" | gh secret set AZURE_BACKEND_PUBLISH_PROFILE --repo "$REPO_OWNER/$REPO_NAME"
    echo "✅ AZURE_BACKEND_PUBLISH_PROFILE added"
else
    echo "❌ backend-publish-profile.xml not found"
    exit 1
fi

echo ""

# ML Publishing Profile
if [ -f "ml-publish-profile.xml" ]; then
    echo "Adding AZURE_ML_PUBLISH_PROFILE..."
    ML_PROFILE=$(cat ml-publish-profile.xml)
    echo "$ML_PROFILE" | gh secret set AZURE_ML_PUBLISH_PROFILE --repo "$REPO_OWNER/$REPO_NAME"
    echo "✅ AZURE_ML_PUBLISH_PROFILE added"
else
    echo "❌ ml-publish-profile.xml not found"
    exit 1
fi

echo ""

# Add variable
echo "Adding VITE_API_URL variable..."
gh variable set VITE_API_URL --body "https://fintrack-api-prod.azurewebsites.net" --repo "$REPO_OWNER/$REPO_NAME"
echo "✅ VITE_API_URL variable added"

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "⚠️  REMAINING MANUAL STEP:"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "You still need to add the Static Web App token manually:"
echo ""
echo "1. Create Static Web App at: https://portal.azure.com/#create/Microsoft.StaticWebApp"
echo "   Settings:"
echo "   - Name: fintrack-frontend"
echo "   - Resource Group: rg-fintrack-student"
echo "   - Region: East US 2"
echo "   - Source: GitHub"
echo ""
echo "2. After creation, get the deployment token:"
echo "   - Go to Static Web App → Overview"
echo "   - Click 'Manage deployment token'"
echo "   - Copy the token"
echo ""
echo "3. Add to GitHub:"
echo "   gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo $REPO_OWNER/$REPO_NAME"
echo "   (then paste the token when prompted)"
echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "✅ GitHub secrets setup complete!"
echo "════════════════════════════════════════════════════════════════════════════"
