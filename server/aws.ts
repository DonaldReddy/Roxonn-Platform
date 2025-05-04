import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { log } from './utils';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users } from '../shared/schema';
import { config } from './config';

// Initialize AWS clients lazily to avoid initialization timing issues
let kmsClient: KMSClient | null = null;
let ssmClient: SSMClient | null = null;

// Parameter path prefix for SSM parameters
const PARAMETER_PATH_PREFIX = '/github-identity';

// Temporary cache for encrypted wallet data that hasn't been assigned to a user yet
// This is a simple in-memory cache for development purposes
// In production, you should use a more robust solution like a dedicated database table
const pendingWalletCache = new Map<string, { 
  encryptedPrivateKey: string; 
  encryptedMnemonic: string; 
  created: Date 
}>();

/**
 * Get the KMS client, initializing it if necessary
 */
function getKMS(): KMSClient {
  if (!kmsClient) {
    const region = config.awsRegion || 'ap-south-1';
    kmsClient = new KMSClient({ region });
    log(`KMS client initialized with region: ${region}`, 'aws');
  }
  return kmsClient;
}

/**
 * Get the SSM client, initializing it if necessary
 */
function getSSM(): SSMClient {
  if (!ssmClient) {
    const region = config.awsRegion || 'ap-south-1';
    ssmClient = new SSMClient({ region });
    log(`SSM client initialized with region: ${region}`, 'aws');
  }
  return ssmClient;
}

/**
 * Get the KMS key ID for wallet data encryption
 */
function getKmsKeyId(): string {
  return config.walletKmsKeyId || 'alias/github-identity';
}

/**
 * Interface for sensitive wallet data
 */
export interface SensitiveWalletData {
  privateKey: string;
  mnemonic: string;
}

/**
 * Get a parameter from SSM Parameter Store with decryption
 * @param parameterName Name of the parameter, without the prefix
 * @returns The parameter value or null if not found
 */
export async function getParameter(parameterName: string): Promise<string | null> {
  try {
    const fullPath = `${PARAMETER_PATH_PREFIX}/${parameterName}`;
    log(`Getting parameter from SSM: ${fullPath}`, 'aws');
    
    const command = new GetParameterCommand({
      Name: fullPath,
      WithDecryption: true
    });
    
    const ssm = getSSM();
    const response = await ssm.send(command);
    
    if (!response.Parameter || !response.Parameter.Value) {
      log(`Parameter not found: ${parameterName}`, 'aws');
      return null;
    }
    
    log(`Parameter retrieved successfully: ${parameterName}`, 'aws');
    return response.Parameter.Value;
  } catch (error) {
    log(`Error getting parameter from SSM: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    // Instead of throwing, return null to allow the application to fall back to env vars
    return null;
  }
}

/**
 * Store a parameter in SSM Parameter Store with encryption
 * @param parameterName Name of the parameter, without the prefix
 * @param parameterValue Value to store
 * @param description Optional description for the parameter
 * @returns True if successful, false otherwise
 */
export async function putParameter(
  parameterName: string, 
  parameterValue: string,
  description: string = ""
): Promise<boolean> {
  try {
    const fullPath = `${PARAMETER_PATH_PREFIX}/${parameterName}`;
    log(`Storing parameter in SSM: ${fullPath}`, 'aws');
    
    const command = new PutParameterCommand({
      Name: fullPath,
      Value: parameterValue,
      Type: 'SecureString',
      Description: description,
      Overwrite: true
    });
    
    const ssm = getSSM();
    await ssm.send(command);
    log(`Parameter stored successfully: ${parameterName}`, 'aws');
    return true;
  } catch (error) {
    log(`Error storing parameter in SSM: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    return false;
  }
}

/**
 * Encrypts wallet data using AWS KMS
 * @param data The data to encrypt
 * @returns Encrypted data as base64 string
 */
async function encryptWithKMS(data: string): Promise<string> {
  try {
    log(`Encrypting data with KMS`, 'aws');
    
    const command = new EncryptCommand({
      KeyId: getKmsKeyId(),
      Plaintext: Buffer.from(data)
    });
    
    const kms = getKMS();
    const response = await kms.send(command);
    
    if (!response.CiphertextBlob) {
      throw new Error('Failed to encrypt data: No ciphertext returned');
    }
    
    // Convert binary data to base64 string for storage
    const encryptedData = Buffer.from(response.CiphertextBlob).toString('base64');
    log('Data encrypted successfully', 'aws');
    
    return encryptedData;
  } catch (error) {
    log(`Error encrypting data with KMS: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    throw error;
  }
}

/**
 * Decrypts wallet data using AWS KMS
 * @param encryptedData The encrypted data as base64 string
 * @returns Decrypted data
 */
async function decryptWithKMS(encryptedData: string): Promise<string> {
  try {
    log(`Decrypting data with KMS`, 'aws');
    
    // Convert base64 string back to binary
    const ciphertextBlob = Buffer.from(encryptedData, 'base64');
    
    const command = new DecryptCommand({
      CiphertextBlob: ciphertextBlob
    });
    
    const kms = getKMS();
    const response = await kms.send(command);
    
    if (!response.Plaintext) {
      throw new Error('Failed to decrypt data: No plaintext returned');
    }
    
    // Convert binary data to string
    const decryptedData = Buffer.from(response.Plaintext).toString('utf-8');
    log('Data decrypted successfully', 'aws');
    
    return decryptedData;
  } catch (error) {
    log(`Error decrypting data with KMS: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    throw error;
  }
}

/**
 * Stores wallet data using AWS KMS for encryption and database for storage
 * @param referenceId Unique reference ID for the wallet
 * @param walletData Sensitive wallet data to store
 */
export async function storeWalletSecret(referenceId: string, walletData: SensitiveWalletData): Promise<void> {
  try {
    log(`Storing wallet data for reference ID: ${referenceId}`, 'aws');
    
    // Encrypt the wallet data
    const privateKeyEncrypted = await encryptWithKMS(walletData.privateKey);
    const mnemonicEncrypted = await encryptWithKMS(walletData.mnemonic);
    
    // Find the user with this reference ID and update their encrypted wallet data
    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletReferenceId, referenceId)
    });
    
    if (existingUser) {
      // Update existing user's encrypted wallet data
      await db
        .update(users)
        .set({
          encryptedPrivateKey: privateKeyEncrypted,
          encryptedMnemonic: mnemonicEncrypted
        })
        .where(eq(users.walletReferenceId, referenceId));
      
      log(`Updated encrypted wallet data for existing user with referenceId: ${referenceId}`, 'aws');
    } else {
      // Store in temporary cache until a user claims this wallet
      log(`No user found with walletReferenceId: ${referenceId}. Storing in temporary cache.`, 'aws');
      
      pendingWalletCache.set(referenceId, {
        encryptedPrivateKey: privateKeyEncrypted,
        encryptedMnemonic: mnemonicEncrypted,
        created: new Date()
      });
      
      log(`Wallet data stored in temporary cache for reference ID: ${referenceId}`, 'aws');
    }
    
    log(`Wallet data stored successfully for reference ID: ${referenceId}`, 'aws');
  } catch (error) {
    log(`Error storing wallet data: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    throw error;
  }
}

/**
 * Retrieves wallet data from database and decrypts it using AWS KMS
 * @param referenceId Unique reference ID for the wallet
 * @returns Sensitive wallet data or null if not found
 */
export async function getWalletSecret(referenceId: string): Promise<SensitiveWalletData | null> {
  try {
    log(`Getting wallet data for reference ID: ${referenceId}`, 'aws');
    
    // Find the user with this wallet reference ID
    const user = await db.query.users.findFirst({
      where: eq(users.walletReferenceId, referenceId),
      columns: {
        encryptedPrivateKey: true,
        encryptedMnemonic: true
      }
    });
    
    // If user exists and has encrypted data, use that
    if (user && user.encryptedPrivateKey && user.encryptedMnemonic) {
      // Decrypt the data
      const privateKey = await decryptWithKMS(user.encryptedPrivateKey);
      const mnemonic = await decryptWithKMS(user.encryptedMnemonic);
      
      log(`Wallet data retrieved successfully from database for reference ID: ${referenceId}`, 'aws');
      
      return {
        privateKey,
        mnemonic
      };
    }
    
    // If not found in database, check the temporary cache
    const cachedData = pendingWalletCache.get(referenceId);
    if (cachedData) {
      log(`Wallet data found in temporary cache for reference ID: ${referenceId}`, 'aws');
      
      // Decrypt the data
      const privateKey = await decryptWithKMS(cachedData.encryptedPrivateKey);
      const mnemonic = await decryptWithKMS(cachedData.encryptedMnemonic);
      
      return {
        privateKey,
        mnemonic
      };
    }
    
    log(`No wallet data found for reference ID: ${referenceId}`, 'aws');
    return null;
  } catch (error) {
    log(`Error getting wallet data: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    return null;
  }
}

/**
 * Generates a data key using AWS KMS
 * This is useful for generating encryption keys for large data
 * @returns Object containing plaintext key and encrypted key
 */
export async function generateDataKey(): Promise<{ plaintextKey: string; encryptedKey: string }> {
  try {
    log('Generating data key with KMS', 'aws');
    
    const command = new GenerateDataKeyCommand({
      KeyId: getKmsKeyId(),
      KeySpec: 'AES_256'
    });
    
    const kms = getKMS();
    const response = await kms.send(command);
    
    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new Error('Failed to generate data key');
    }
    
    // Convert binary data to base64 strings
    const plaintextKey = Buffer.from(response.Plaintext).toString('base64');
    const encryptedKey = Buffer.from(response.CiphertextBlob).toString('base64');
    
    log('Data key generated successfully', 'aws');
    
    return {
      plaintextKey,
      encryptedKey
    };
  } catch (error) {
    log(`Error generating data key: ${error instanceof Error ? error.message : String(error)}`, 'aws');
    throw error;
  }
} 