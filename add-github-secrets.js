#!/usr/bin/env node

/**
 * FinTrack GitHub Secrets Automation Script
 * Automatically adds Azure deployment secrets to GitHub repository
 * 
 * Usage: 
 *   node add-github-secrets.js <github-username> <github-repo> <github-token>
 * 
 * Example:
 *   node add-github-secrets.js Harshith7103 Fintrack ghp_xxxxxxxxxxxx
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const args = process.argv.slice(2);
const GITHUB_USERNAME = args[0] || 'Harshith7103';
const GITHUB_REPO = args[1] || 'Fintrack';
const GITHUB_TOKEN = args[2];

if (!GITHUB_TOKEN) {
    console.error('❌ GitHub token is required!');
    console.error('Usage: node add-github-secrets.js <username> <repo> <token>');
    process.exit(1);
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  GitHub Secrets Automation - FinTrack Deployment              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

function makeGitHubRequest(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'FinTrack-Deployment'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function addSecret(secretName, secretValue) {
    console.log(`\n📝 Adding secret: ${secretName}`);
    
    try {
        // GitHub API endpoint for secrets
        const endpoint = `/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/actions/secrets/${secretName}`;
        
        const payload = {
            encrypted_value: Buffer.from(secretValue).toString('base64'),
            key_id: '012345'
        };

        const response = await makeGitHubRequest('PUT', endpoint, payload);
        
        if (response.status === 201 || response.status === 204) {
            console.log(`✅ ${secretName} added successfully`);
            return true;
        } else {
            console.log(`⚠️  Status: ${response.status}`);
            return false;
        }
    } catch (err) {
        console.error(`❌ Error adding ${secretName}:`, err.message);
        return false;
    }
}

async function main() {
    console.log(`Repository: ${GITHUB_USERNAME}/${GITHUB_REPO}`);
    console.log(`Token: ${GITHUB_TOKEN.substring(0, 10)}...\n`);

    // Read secret files
    console.log('📁 Reading deployment credentials...\n');

    let backendProfile = '';
    let mlProfile = '';

    try {
        if (fs.existsSync('backend-publish-profile.xml')) {
            backendProfile = fs.readFileSync('backend-publish-profile.xml', 'utf-8');
            console.log('✓ backend-publish-profile.xml loaded');
        } else {
            console.error('❌ backend-publish-profile.xml not found');
            return;
        }

        if (fs.existsSync('ml-publish-profile.xml')) {
            mlProfile = fs.readFileSync('ml-publish-profile.xml', 'utf-8');
            console.log('✓ ml-publish-profile.xml loaded');
        } else {
            console.error('❌ ml-publish-profile.xml not found');
            return;
        }
    } catch (err) {
        console.error('❌ Error reading files:', err.message);
        return;
    }

    console.log('\n' + '='.repeat(64) + '\n');
    console.log('🔐 Adding GitHub Secrets...\n');

    // Add secrets
    const secrets = [
        { name: 'AZURE_BACKEND_PUBLISH_PROFILE', value: backendProfile },
        { name: 'AZURE_ML_PUBLISH_PROFILE', value: mlProfile }
    ];

    let addedCount = 0;
    for (const secret of secrets) {
        const success = await addSecret(secret.name, secret.value);
        if (success) addedCount++;
    }

    console.log('\n' + '='.repeat(64));
    console.log(`\n✅ Secrets added: ${addedCount}/${secrets.length}`);
    
    if (addedCount === 2) {
        console.log('\n⚠️  REMAINING MANUAL STEP:');
        console.log('\nAdd Static Web App token manually:');
        console.log('1. Get token from: Azure Portal → Static Web App → Manage deployment token');
        console.log('2. Go to: GitHub → Settings → Secrets and variables → Actions');
        console.log('3. Add secret: AZURE_STATIC_WEB_APPS_API_TOKEN');
        console.log('\nAlso add variable:');
        console.log('4. Add variable: VITE_API_URL = https://fintrack-api-prod.azurewebsites.net');
    }

    console.log('\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
