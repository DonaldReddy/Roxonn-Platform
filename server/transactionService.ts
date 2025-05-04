import { ethers } from 'ethers';
import { log } from './utils';
import { getWalletSecret } from './aws';
import { config } from './config';
import { db } from './db';
import { eq } from 'drizzle-orm';

/**
 * Secure transaction signing service
 * This service signs transactions without exposing private keys
 */
export class TransactionService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.xdcNodeUrl);
  }

  /**
   * Signs a transaction without exposing the private key
   * @param transaction Transaction data to sign
   * @param walletReferenceId Reference ID for the wallet to use for signing
   * @returns Signed transaction
   */
  async signTransaction(
    transaction: ethers.TransactionRequest,
    walletReferenceId: string
  ): Promise<string> {
    try {
      log(`Signing transaction for wallet reference: ${walletReferenceId}`, 'transaction');
      
      // Get wallet private key securely from AWS KMS
      const walletData = await getWalletSecret(walletReferenceId);
      
      if (!walletData || !walletData.privateKey) {
        throw new Error(`No wallet found for reference ID: ${walletReferenceId}`);
      }
      
      // Create a wallet instance with the private key
      const wallet = new ethers.Wallet(walletData.privateKey, this.provider);
      
      // Sign the transaction
      const signedTx = await wallet.signTransaction(transaction);
      
      log('Transaction signed successfully', 'transaction');
      
      // Return signed transaction WITHOUT exposing private key
      return signedTx;
    } catch (error) {
      log(`Error signing transaction: ${error instanceof Error ? error.message : String(error)}`, 'transaction');
      throw error;
    }
  }
  
  /**
   * Retrieves wallet secret data by reference ID
   * @param walletReferenceId Reference ID for the wallet
   * @returns Wallet secret data containing private key
   */
  async getWalletSecret(walletReferenceId: string): Promise<{ privateKey: string }> {
    try {
      log(`Retrieving wallet secret for reference ID: ${walletReferenceId}`, 'transaction');
      
      // Get wallet private key securely from AWS KMS
      const walletData = await getWalletSecret(walletReferenceId);
      
      if (!walletData || !walletData.privateKey) {
        throw new Error(`No wallet found for reference ID: ${walletReferenceId}`);
      }
      
      return walletData;
    } catch (error) {
      log(`Error retrieving wallet secret: ${error instanceof Error ? error.message : String(error)}`, 'transaction');
      throw error;
    }
  }

  /**
   * Sends a transaction without exposing the private key
   * @param transaction Transaction data to send
   * @param walletReferenceId Reference ID for the wallet to use for signing
   * @returns Transaction hash
   */
  async sendTransaction(
    transaction: ethers.TransactionRequest,
    walletReferenceId: string
  ): Promise<string> {
    try {
      log(`Sending transaction for wallet reference: ${walletReferenceId}`, 'transaction');
      
      // Get wallet private key securely from AWS KMS
      const walletData = await getWalletSecret(walletReferenceId);
      
      if (!walletData || !walletData.privateKey) {
        throw new Error(`No wallet found for reference ID: ${walletReferenceId}`);
      }
      
      // Create a wallet instance with the private key
      const wallet = new ethers.Wallet(walletData.privateKey, this.provider);
      
      // Send the transaction
      const tx = await wallet.sendTransaction(transaction);
      
      log(`Transaction sent successfully: ${tx.hash}`, 'transaction');
      
      // Return transaction hash
      return tx.hash;
    } catch (error) {
      log(`Error sending transaction: ${error instanceof Error ? error.message : String(error)}`, 'transaction');
      throw error;
    }
  }
}

// Export a singleton instance
export const transactionService = new TransactionService(); 