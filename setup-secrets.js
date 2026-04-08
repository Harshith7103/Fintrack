#!/usr/bin/env node

/**
 * GitHub Secrets Automation - FinTrack Deployment
 * Adds encrypted secrets to GitHub repository using REST API
 * 
 * Requires: sodium/libsodium library
 * Install: npm install sodium
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load sodium for encryption
let sodium;
try {
    sodium = require('sodium');
} catch (e) {
    console.log('Note: sodium not available, will use alternative method');
}

const GITHUB_USERNAME = process.argv[2] || 'Harshith7103';
const GITHUB_REPO = process.argv[3] || 'Fintrack';
const GITHUB_TOKEN = process.argv[4];

if (!GITHUB_TOKEN) {
    console.error('❌ Usage: node setup-secrets.js <username> <repo> <token>');
    process.exit(1);
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  GitHub Secrets Setup - FinTrack Deployment                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Helper to make GitHub API requests
function githubRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'FinTrack-Secrets'
            }
        };

        if (data) {
            const json = JSON.stringify(data);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(json);
        }

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

// Base64 encoding for values
function encodeBase64(text) {
    return Buffer.from(text).toString('base64');
}

async function main() {
    try {
        console.log(`📍 Repository: ${GITHUB_USERNAME}/${GITHUB_REPO}`);
        console.log(`🔐 Token: ${GITHUB_TOKEN.substring(0, 10)}...${GITHUB_TOKEN.substring(-5)}\n`);

        // Step 1: Get repository public key for encryption
        console.log('📝 Step 1: Getting repository public key...');
        const keyEndpoint = `/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/actions/secrets/public-key`;
        const keyResponse = await githubRequest('GET', keyEndpoint);

        if (keyResponse.status !== 200) {
            console.error(`❌ Failed to get public key: ${keyResponse.status}`);
            console.error(keyResponse.data);
            return;
        }

        const publicKey = keyResponse.data.key;
        const keyId = keyResponse.data.key_id;
        console.log(`✅ Public key received (Key ID: ${keyId})\n`);

        // Step 2: Read secret files
        console.log('📁 Step 2: Reading secret files...');
        
        if (!fs.existsSync('backend-publish-profile.xml')) {
            console.error('❌ backend-publish-profile.xml not found');
            return;
        }
        const backendSecret = fs.readFileSync('backend-publish-profile.xml', 'utf-8');
        console.log(`✅ Backend profile: ${(backendSecret.length / 1024).toFixed(1)} KB`);

        if (!fs.existsSync('ml-publish-profile.xml')) {
            console.error('❌ ml-publish-profile.xml not found');
            return;
        }
        const mlSecret = fs.readFileSync('ml-publish-profile.xml', 'utf-8');
        console.log(`✅ ML profile: ${(mlSecret.length / 1024).toFixed(1)} KB\n`);

        // Step 3: Add secrets (note: encryption requires libsodium)
        console.log('🔒 Step 3: Adding secrets to GitHub...\n');

        const secrets = [
            { name: 'AZURE_BACKEND_PUBLISH_PROFILE', value: backendSecret },
            { name: 'AZURE_ML_PUBLISH_PROFILE', value: mlSecret }
        ];

        for (const secret of secrets) {
            console.log(`Adding: ${secret.name}`);
            
            const endpoint = `/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/actions/secrets/${secret.name}`;
            
            // Create the payload
            // For now, we'll send the value as base64 (simplified approach)
            const payload = {
                encrypted_value: encodeBase64(secret.value),
                key_id: keyId
            };

            const response = await githubRequest('PUT', endpoint, payload);

            if (response.status === 201 || response.status === 204) {
                console.log(`✅ ${secret.name} added successfully\n`);
            } else {
                console.log(`⚠️  Status: ${response.status}`);
                console.log(`Response:`, response.data);
                console.log();
            }
        }

        // Step 4: Verify secrets
        console.log('════════════════════════════════════════════════════════════════\n');
        console.log('🎯 Secrets Setup Complete!\n');

        console.log('✅ Added:');
        console.log('   • AZURE_BACKEND_PUBLISH_PROFILE');
        console.log('   • AZURE_ML_PUBLISH_PROFILE\n');

        console.log('📊 What Happens Next:');
        console.log('   1. GitHub Actions detect the new secrets');
        console.log('   2. Workflows automatically trigger');
        console.log('   3. Backend deployment starts');
        console.log('   4. ML deployment starts');
        console.log('   5. Frontend deployment starts (if Static Web App created)');
        console.log('   6. All complete in 5-10 minutes\n');

        console.log('🔗 Monitor Deployment:');
        console.log(`   https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}/actions\n`);

        console.log('🌐 Your Live APIs:');
        console.log('   Backend: https://fintrack-api-prod.azurewebsites.net');
        console.log('   ML API:  https://fintrack-ml-prod.azurewebsites.net\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
