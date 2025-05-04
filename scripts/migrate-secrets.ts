/**
 * Script to migrate secrets from .env file to AWS Parameter Store
 * 
 * Usage: 
 * 1. Make sure you have AWS credentials configured
 * 2. Run: npm run migrate-secrets
 * 
 * Note: This script should be run once to migrate secrets to Parameter Store
 * After migration, set USE_PARAMETER_STORE=true in your .env file
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { readFileSync } from 'fs';

// Load environment variables from .env file
const envPath = resolve(process.cwd(), 'server/.env');
dotenv.config({ path: envPath });

// Define the AWS region
const region = process.env.AWS_REGION || 'ap-south-1';

// Initialize the SSM client
const ssm = new SSMClient({ region });

// Parameter path prefix for SSM parameters
const PARAMETER_PATH_PREFIX = '/github-identity';

// Define the secrets to migrate
const secretsToMigrate = [
  { 
    name: 'github/client-secret', 
    envVar: 'GITHUB_CLIENT_SECRET',
    description: 'GitHub OAuth client secret'
  },
  { 
    name: 'github/pat', 
    envVar: 'GITHUB_PAT',
    description: 'GitHub Personal Access Token'
  },
  { 
    name: 'github/app-private-key', 
    envVar: 'GITHUB_APP_PRIVATE_KEY',
    description: 'GitHub App private key' 
  },
  { 
    name: 'github/app-webhook-secret', 
    envVar: 'GITHUB_APP_WEBHOOK_SECRET',
    description: 'GitHub App webhook secret'
  },
  { 
    name: 'auth/session-secret', 
    envVar: 'SESSION_SECRET',
    description: 'Session secret for authentication'
  },
  { 
    name: 'blockchain/relayer-private-key', 
    envVar: 'PRIVATE_KEY',
    description: 'Blockchain relayer private key'
  },
  { 
    name: 'crypto/encryption-key', 
    envVar: 'ENCRYPTION_KEY',
    description: 'Encryption key for sensitive data'
  },
  { 
    name: 'crypto/private-key-secret', 
    envVar: 'PRIVATE_KEY_SECRET',
    description: 'Secret for private key encryption'
  },
  { 
    name: 'database/url', 
    envVar: 'DATABASE_URL',
    description: 'Database connection URL'
  },
  { 
    name: 'tatum/api-key', 
    envVar: 'TATUM_API_KEY',
    description: 'Tatum API key'
  },
];

/**
 * Store a parameter in SSM Parameter Store
 */
async function storeParameterInSSM(
  parameterName: string, 
  parameterValue: string,
  description: string = ""
): Promise<boolean> {
  try {
    const fullPath = `${PARAMETER_PATH_PREFIX}/${parameterName}`;
    console.log(`Storing parameter in SSM: ${fullPath}`);
    
    const command = new PutParameterCommand({
      Name: fullPath,
      Value: parameterValue,
      Type: 'SecureString',
      Description: description,
      Overwrite: true
    });
    
    await ssm.send(command);
    console.log(`✅ Parameter stored successfully: ${parameterName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error storing parameter in SSM: ${parameterName}`, error);
    return false;
  }
}

/**
 * Migrate all secrets to Parameter Store
 */
async function migrateSecrets() {
  console.log('Starting secrets migration to AWS Parameter Store...');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const secret of secretsToMigrate) {
    const value = process.env[secret.envVar];
    
    if (!value) {
      console.warn(`⚠️ Warning: ${secret.envVar} is not set in environment variables, skipping...`);
      continue;
    }
    
    const success = await storeParameterInSSM(secret.name, value, secret.description);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\nMigration completed:');
  console.log(`- Successfully migrated: ${successCount} secrets`);
  console.log(`- Failed to migrate: ${failCount} secrets`);
  
  if (successCount > 0) {
    console.log('\nNext steps:');
    console.log('1. Add USE_PARAMETER_STORE=true to your .env file');
    console.log('2. Restart your application to use Parameter Store for secrets');
    console.log('3. Consider removing sensitive values from your .env file once confirmed working');
  }
}

// Run the migration
migrateSecrets().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 