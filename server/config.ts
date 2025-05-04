// Load environment variables
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getParameter } from './aws';

// Get directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Always use server/.env regardless of environment
const envPath = resolve(process.cwd(), 'server/.env');

// Load environment variables from server/.env
dotenv.config({ path: envPath });

// Basic configuration that doesn't require secure parameters
export const baseConfig = {
  // URLs and domains
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',
  
  // Server settings
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // GitHub OAuth (non-sensitive)
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL,
  githubOrg: process.env.GITHUB_ORG || 'Roxonn-FutureTech',
  githubAppId: process.env.GITHUB_APP_ID,
  githubAppName: process.env.GITHUB_APP_NAME,
  
  // Blockchain (non-sensitive)
  xdcNodeUrl: process.env.XDC_RPC_URL || 'https://rpc.ankr.com/xdc',
  repoRewardsContractAddress: process.env.REPO_REWARDS_CONTRACT_ADDRESS || '',
  repoRewardsImplAddress: process.env.REPO_REWARDS_IMPL_ADDRESS || '',
  forwarderContractAddress: process.env.FORWARDER_CONTRACT_ADDRESS || '0x3bF77b9192E1bc9d780fcA8eC51C2a0edc2B8aD5',
  roxnTokenAddress: process.env.ROXN_TOKEN_ADDRESS || '0xD0b99c496e7Bd6EFE62Fc4cBfB2A796B62e59c2c',
  roxnTokenImplAddress: process.env.ROXN_TOKEN_IMPL_ADDRESS || '',
  feeCollectorAddress: process.env.FEE_COLLECTOR_ADDRESS || '0x0466bed6087FBAC2bDaf284cF6bf52FfE7Ff2336',
  platformFeeRate: parseInt(process.env.PLATFORM_FEE_RATE || '300'), // Default 3%
  contributorFeeRate: parseInt(process.env.CONTRIBUTOR_FEE_RATE || '200'), // Default 2%
  
  // Database (non-sensitive parts)
  dbSchema: process.env.DB_SCHEMA || 'staging',
  
  // AWS
  walletKmsKeyId: process.env.WALLET_KMS_KEY_ID,
  awsRegion: process.env.AWS_REGION,
  
  // Zoho CRM Integration
  zohoClientId: process.env.ZOHO_CLIENT_ID,
  
  // Flag to use SSM parameters or fallback to environment variables
  useParameterStore: process.env.USE_PARAMETER_STORE === 'true',
} as const;

// Full configuration with sensitive values that will be populated
export let config = {
  ...baseConfig,
  
  // Sensitive values (will be populated from Parameter Store)
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  githubPat: process.env.GITHUB_PAT,
  githubAppPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
  githubAppWebhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET,
  sessionSecret: process.env.SESSION_SECRET,
  relayerPrivateKey: process.env.PRIVATE_KEY || '',
  encryptionKey: process.env.ENCRYPTION_KEY,
  privateKeySecret: process.env.PRIVATE_KEY_SECRET || 'roxonn-secret',
  databaseUrl: process.env.DATABASE_URL,
  tatumApiKey: process.env.TATUM_API_KEY,
  zohoClientSecret: process.env.ZOHO_CLIENT_SECRET,
  zohoRefreshToken: process.env.ZOHO_REFRESH_TOKEN,
} as const;

// Initialize config from SSM Parameter Store
export async function initializeConfig() {
  if (!baseConfig.useParameterStore) {
    console.log('Using environment variables for sensitive configuration');
    return;
  }
  
  console.log('Loading sensitive configuration from Parameter Store');
  
  try {
    // List of parameters to load from Parameter Store
    const parameterMap: Record<string, string> = {
      'github/client-secret': 'githubClientSecret',
      'github/pat': 'githubPat',
      'github/app-private-key': 'githubAppPrivateKey',
      'github/app-webhook-secret': 'githubAppWebhookSecret',
      'auth/session-secret': 'sessionSecret',
      'blockchain/relayer-private-key': 'relayerPrivateKey',
      'crypto/encryption-key': 'encryptionKey',
      'crypto/private-key-secret': 'privateKeySecret',
      'database/url': 'databaseUrl',
      'tatum/api-key': 'tatumApiKey',
    };
    
    // Load parameters in parallel
    const parameterPromises = Object.entries(parameterMap).map(async ([paramName, configKey]) => {
      const value = await getParameter(paramName);
      if (value !== null) {
        // Special handling for private key to handle newlines
        if (configKey === 'githubAppPrivateKey') {
          (config as any)[configKey] = value.replace(/\\n/g, '\n');
        } else {
          (config as any)[configKey] = value;
        }
        console.log(`Loaded parameter: ${paramName}`);
      } else {
        console.log(`Parameter not found: ${paramName}, using environment variable`);
      }
    });
    
    await Promise.all(parameterPromises);
    console.log('Configuration initialized from Parameter Store');
  } catch (error) {
    console.error('Error initializing config from Parameter Store:', error);
    console.log('Falling back to environment variables for sensitive configuration');
  }
}

// Validate required environment variables when env vars are being used
export function validateConfig() {
  if (baseConfig.useParameterStore) {
    // Skip validation when using Parameter Store
    return;
  }
  
  const requiredEnvVars = [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'SESSION_SECRET',
    'XDC_RPC_URL',
    'REPO_REWARDS_CONTRACT_ADDRESS',
    'FORWARDER_CONTRACT_ADDRESS',
    'PRIVATE_KEY', // Relayer key
    'DATABASE_URL',
    'ENCRYPTION_KEY',
    'BASE_URL',
    'FRONTEND_URL',
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_APP_WEBHOOK_SECRET',
    'GITHUB_APP_NAME',
  ] as const;

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}
