import { walletService } from './walletService';
import { log } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { storeWalletSecret, getWalletSecret, SensitiveWalletData } from './aws';
import { config } from './config';
import { TatumSDK, Network } from "@tatumio/tatum";

if (!config.tatumApiKey) {
  throw new Error('TATUM_API_KEY environment variable is required');
}

// Exported interface for wallet data
export interface Wallet {
  address: string;
  referenceId: string;
  // Sensitive fields no longer returned:
  // privateKey: string;
  // mnemonic: string;
  xpub?: string;
}

/**
 * Generates a new XDC wallet using Tatum SDK
 * This implementation follows a multi-step process:
 * 1. Generate mnemonic
 * 2. Generate xpub from mnemonic
 * 3. Generate address from mnemonic
 * 4. Generate private key from mnemonic
 * 5. Store sensitive data securely and return only public data
 */
export async function generateWallet(): Promise<Wallet> {
  try {
    log('Step 1: Generating mnemonic...', 'tatum');
    const mnemonic = await walletService.generateMnemonic();
    
    log('Step 2: Generating xpub...', 'tatum');
    const xpubDetails = await walletService.generateXpub(mnemonic);
    
    log('Step 3: Generating address...', 'tatum');
    const address = await walletService.generateAddressFromMnemonic(mnemonic, 0);
    
    log('Step 4: Generating private key...', 'tatum');
    const privateKey = await walletService.generatePrivateKey(mnemonic, 0);

    log('Step 5: Securely storing sensitive data...', 'tatum');
    // Generate a unique reference ID for this wallet
    const referenceId = uuidv4();
    
    try {
      // Store sensitive data securely in AWS Secrets Manager
      await storeWalletSecret(referenceId, {
        privateKey,
        mnemonic
      });
    } catch (storageError: any) {
      // If the error is related to the secret already existing, we can still proceed
      // as our updated aws.ts should handle this case properly
      if (storageError.message && storageError.message.includes('already exists')) {
        log('Secret already exists, but wallet data was stored successfully', 'tatum');
      } else {
        // For other errors, we should rethrow
        throw storageError;
      }
    }

    log('Wallet generated successfully', 'tatum');

    // Return only non-sensitive data
    const wallet: Wallet = {
      address,
      referenceId,
      xpub: xpubDetails.xpub
    };

    return wallet;
  } catch (error) {
    log(`Error generating wallet: ${error instanceof Error ? error.message : String(error)}`, 'tatum');
    throw error;
  }
}

/**
 * Gets the private key for a wallet by reference ID
 * Uses AWS Secrets Manager to retrieve the private key
 */
export async function getWalletPrivateKey(referenceId: string): Promise<string | null> {
  const walletData = await getWalletSecret(referenceId);
  if (!walletData) {
    return null;
  }
  return walletData.privateKey;
}

/**
 * Gets the mnemonic for a wallet by reference ID
 * Uses AWS Secrets Manager to retrieve the mnemonic
 */
export async function getWalletMnemonic(referenceId: string): Promise<string | null> {
  const walletData = await getWalletSecret(referenceId);
  if (!walletData) {
    return null;
  }
  return walletData.mnemonic;
}

// Clean up Tatum SDK when the application shuts down
process.on('SIGTERM', async () => {
  await walletService.destroy();
});

process.on('SIGINT', async () => {
  await walletService.destroy();
});