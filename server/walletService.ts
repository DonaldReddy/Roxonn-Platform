import { TatumSDK, Network } from '@tatumio/tatum';
import { EvmWalletProvider } from '@tatumio/evm-wallet-provider';
import { log } from './utils';
import { config } from './config';
import { ethers } from 'ethers';
import { db, users } from "./db";
import { generateMnemonic, mnemonicToSeed } from "ethereum-cryptography/bip39";
import { HDKey } from "ethereum-cryptography/hdkey";

export interface WalletDetails {
    address: string;
    privateKey?: string;
    mnemonic?: string;
    xpub?: string;
}

// Custom network configuration for XDC
interface XdcNetwork {
    name: string;
    rpc: string;
    chainId: number;
}

export class WalletService {
    private tatumSdk: any;
    private tatumApiKey: string = config.tatumApiKey || '';

    constructor() {
        this.initializeSdk();
    }

    private async initializeSdk() {
        if (!this.tatumApiKey) {
            log("No Tatum API key provided, wallet service functionality will be limited", "wallet");
            return;
        }

        try {
            log('Initializing Tatum SDK...', 'wallet');
            
            // Initialize SDK with XDC Mainnet configuration
            this.tatumSdk = await TatumSDK.init({
                configureWalletProviders: [EvmWalletProvider],
                network: Network.XINFIN,
                apiKey: {
                    v4: this.tatumApiKey
                }
            });
            log('Tatum SDK initialized successfully', 'wallet');
        } catch (error: any) {
            log(`Failed to initialize Tatum SDK: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async generateMnemonic(): Promise<string> {
        try {
            const mnemonic = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .generateMnemonic();
            
            log('Generated new mnemonic', 'wallet');
            return mnemonic;
        } catch (error: any) {
            log(`Failed to generate mnemonic: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async generateXpub(mnemonic: string): Promise<{ xpub: string }> {
        try {
            const xpubDetails = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .generateXpub(mnemonic);
            
            log('Generated xpub from mnemonic', 'wallet');
            return xpubDetails;
        } catch (error: any) {
            log(`Failed to generate xpub: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async generateAddressFromMnemonic(mnemonic: string, index: number = 0): Promise<string> {
        try {
            const address = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .generateAddressFromMnemonic(mnemonic, index);
            
            // Convert to XDC format
            const xdcAddress = address.startsWith('0x') ? `xdc${address.slice(2)}` : address;
            log(`Generated address from mnemonic at index ${index}`, 'wallet');
            return xdcAddress;
        } catch (error: any) {
            log(`Failed to generate address from mnemonic: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async generateAddressFromXpub(xpub: string, index: number = 0): Promise<string> {
        try {
            const address = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .generateAddressFromXpub(xpub, index);
            
            // Convert to XDC format
            const xdcAddress = address.startsWith('0x') ? `xdc${address.slice(2)}` : address;
            log(`Generated address from xpub at index ${index}`, 'wallet');
            return xdcAddress;
        } catch (error: any) {
            log(`Failed to generate address from xpub: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async generatePrivateKey(mnemonic: string, index: number = 0): Promise<string> {
        try {
            const privateKey = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .generatePrivateKeyFromMnemonic(mnemonic, index);
            
            log(`Generated private key from mnemonic at index ${index}`, 'wallet');
            return privateKey;
        } catch (error: any) {
            log(`Failed to generate private key: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async signAndBroadcastTransaction(payload: {
        privateKey: string;
        to: string;
        value?: string;
        data?: string;
        nonce?: number;
        gasLimit?: string;
        gasPrice?: string;
    }): Promise<string> {
        try {
            // Convert XDC address to ETH format if needed
            const toAddress = payload.to.startsWith('xdc') ? `0x${payload.to.slice(3)}` : payload.to;
            
            // Get current gas price if not provided
            if (!payload.gasPrice) {
                const feeData = await this.tatumSdk.rpc.getFeeData();
                payload.gasPrice = feeData.gasPrice.toString();
            }

            // Estimate gas limit if not provided
            if (!payload.gasLimit) {
                const estimatedGas = await this.tatumSdk.rpc.estimateGas({
                    to: toAddress,
                    value: payload.value ? ethers.parseEther(payload.value) : 0,
                    data: payload.data
                });
                payload.gasLimit = estimatedGas.toString();
            }

            const txHash = await this.tatumSdk.walletProvider
                .use(EvmWalletProvider)
                .signAndBroadcast({
                    ...payload,
                    to: toAddress
                });
            
            log(`Transaction signed and broadcasted: ${txHash}`, 'wallet');
            return txHash;
        } catch (error: any) {
            log(`Failed to sign and broadcast transaction: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async getBalance(address: string): Promise<string> {
        try {
            // Convert XDC address to ETH format if needed
            const ethAddress = address.startsWith('xdc') ? `0x${address.slice(3)}` : address;
            
            const balance = await this.tatumSdk.rpc.getBalance(ethAddress);
            log(`Got balance for address ${address}`, 'wallet');
            return balance.toString();
        } catch (error: any) {
            log(`Failed to get balance: ${error.message}`, 'wallet');
            throw error;
        }
    }

    async destroy() {
        if (this.tatumSdk) {
            await this.tatumSdk.destroy();
            log('Tatum SDK destroyed', 'wallet');
        }
    }
}

// Export singleton instance
export const walletService = new WalletService(); 