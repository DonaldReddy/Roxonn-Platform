import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { log } from './utils';
import { config } from './config';
import { storage } from './storage';
import { transactionService } from './transactionService';
import type { Repository, IssueReward, AllocateRewardResponse } from '../shared/schema';
import { getWalletPrivateKey } from "./tatum";
import { walletService } from "./walletService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read contract artifacts
const RepoRewardsContract = JSON.parse(
  readFileSync(join(__dirname, '../contracts/artifacts/contracts/RepoRewards.sol/RepoRewards.json'), 'utf-8')
);
const CustomForwarderContract = JSON.parse(
  readFileSync(join(__dirname, '../contracts/artifacts/contracts/CustomForwarder.sol/CustomForwarder.json'), 'utf-8')
);
const ROXNTokenContract = JSON.parse(
  readFileSync(join(__dirname, '../contracts/artifacts/contracts/ROXNToken.sol/ROXNToken.json'), 'utf-8')
);

const RepoRewardsABI = RepoRewardsContract.abi;
const CustomForwarderABI = CustomForwarderContract.abi;
const ROXNTokenABI = ROXNTokenContract.abi;

interface TransactionRequest {
    to: string;
    data: string;
    gasPrice: bigint;
    gasLimit: bigint;
    chainId: number;
    nonce?: number;
}

interface ExtendedContract extends ethers.Contract {
    // Define contract methods as indexed properties to avoid type errors
    [key: string]: any;
    // We also explicitly define the methods for better IDE support
    addPoolManager(repoId: number, poolManager: string, username: string, githubId: number): Promise<ethers.ContractTransaction>;
    allocateIssueReward(repoId: number, issueId: number, reward: bigint): Promise<ethers.ContractTransaction>;
    addFundToRepository(repoId: number, overrides?: ethers.Overrides & { from?: string | Promise<string> }): Promise<ethers.TransactionResponse>;
    distributeReward(repoId: number, issueId: number, contributorAddress: string): Promise<ethers.ContractTransaction>;
    getRepository(repoId: number): Promise<[string[], string[], bigint, any[]]>;
    getIssueRewards(repoId: number, issueIds: number[]): Promise<bigint[]>;
}

interface TokenContract extends ethers.Contract {
    // Define contract methods as indexed properties to avoid type errors
    [key: string]: any;
    // We also explicitly define the methods for better IDE support
    balanceOf(account: string): Promise<bigint>;
    approve(spender: string, amount: bigint): Promise<ethers.ContractTransaction>;
    transfer(to: string, amount: bigint): Promise<ethers.ContractTransaction>;
    transferFrom(from: string, to: string, amount: bigint): Promise<ethers.ContractTransaction>;
    allowance(owner: string, spender: string): Promise<bigint>;
}

interface UnsignedTransaction {
    to: string;
    data: string;
    gasPrice: bigint;
    gasLimit: bigint;
    chainId: number;
    nonce: number;
}

export class BlockchainService {
    private provider!: ethers.JsonRpcProvider;
    private relayerWallet!: ethers.Wallet;
    private contract!: ExtendedContract;
    private forwarderContract!: ethers.Contract;
    private tokenContract!: TokenContract;
    private userWallets: Map<string, ethers.Wallet> = new Map();

    constructor() {
        this.initializeProvider();
    }
    
    /**
     * Initialize contract parameters including fee collector address
     * This runs after the provider is initialized to ensure contracts are properly configured
     */
    private async initializeContractParameters() {
        try {
            log('Initializing contract parameters', 'blockchain');
            
            // Check if fee collector is set in the contract
            const currentFeeCollector = await this.contract.feeCollector();
            const currentFeeRate = await this.contract.platformFeeRate();
            
            // Convert configured address to checksum address for comparison
            const configuredFeeCollector = ethers.getAddress(config.feeCollectorAddress.replace('xdc', '0x'));
            
            // Only update if the current values don't match the configuration
            if (currentFeeCollector.toLowerCase() !== configuredFeeCollector.toLowerCase() || 
                currentFeeRate.toString() !== config.platformFeeRate.toString()) {
                
                log(`Updating fee parameters: 
  Collector: ${configuredFeeCollector}
  Rate: ${config.platformFeeRate}`, 'blockchain');
                
                // Update fee parameters using the contract owner wallet (relayer wallet)
                const tx = await this.contract.updateFeeParameters(
                    configuredFeeCollector,
                    config.platformFeeRate
                );
                
                // Wait for transaction confirmation
                const receipt = await tx.wait();
                
                if (!receipt) {
                    throw new Error('Failed to update fee parameters');
                }
                
                log('Fee parameters successfully updated', 'blockchain');
            } else {
                log('Fee parameters already up to date', 'blockchain');
            }
        } catch (error) {
            log(`Error initializing contract parameters: ${error}`, 'blockchain');
            // Don't throw the error - just log it
            // This allows the service to start even if fee parameters can't be updated
            // Admin can manually update later if needed
        }
    }

    private initializeProvider() {
        try {
            log(`Initializing provider with node URL: ${config.xdcNodeUrl}`, "blockchain");

            // Create a basic provider without additional network configurations to avoid issues
            this.provider = new ethers.JsonRpcProvider(config.xdcNodeUrl);

            // Initialize relayer wallet
            this.relayerWallet = new ethers.Wallet(config.relayerPrivateKey, this.provider);

            // Initialize contract instances with explicit configurations
            const contractConfig = {
                address: config.repoRewardsContractAddress.replace('xdc', '0x'),
                abi: RepoRewardsABI,
                signerOrProvider: this.relayerWallet
            };

            const forwarderConfig = {
                address: config.forwarderContractAddress.replace('xdc', '0x'),
                abi: CustomForwarderABI,
                signerOrProvider: this.relayerWallet
            };
            
            const tokenConfig = {
                address: config.roxnTokenAddress.replace('xdc', '0x'),
                abi: ROXNTokenABI,
                signerOrProvider: this.relayerWallet
            };

            this.contract = new ethers.Contract(
                contractConfig.address,
                contractConfig.abi,
                contractConfig.signerOrProvider
            ) as ExtendedContract;

            this.forwarderContract = new ethers.Contract(
                forwarderConfig.address,
                forwarderConfig.abi,
                forwarderConfig.signerOrProvider
            );
            
            this.tokenContract = new ethers.Contract(
                tokenConfig.address,
                tokenConfig.abi,
                tokenConfig.signerOrProvider
            ) as TokenContract;

            // Verify network connection
            this.provider.getNetwork().then(async network => {
                log(`Connected to network: chainId=${network.chainId}`, "blockchain");
                
                // Initialize contract parameters after connecting to network
                try {
                    await this.initializeContractParameters();
                } catch (paramError) {
                    log(`Warning: Failed to initialize contract parameters: ${paramError}`, "blockchain");
                    // Continue execution even if parameters initialization fails
                }
                
                log("Blockchain service initialized successfully", "blockchain");
            });
        } catch (error: any) {
            log(`Failed to initialize provider: ${error.message}`, "blockchain");
            throw error;
        }
    }

    private getWallet(privateKey: string): ethers.Wallet {
        return new ethers.Wallet(privateKey, this.provider);
    }

    async registerUser(username: string, githubId: number, typeOfUser: string, userAddress: string) {
        try {
            log(`Registering user ${username} (${userAddress}) as ${typeOfUser}`, "blockchain");
            
            // Convert XDC address to ETH format if needed
            const ethAddress = userAddress.replace('xdc', '0x');
            
            // Skip gas check for registration - relayer pays for this transaction
            // Use the original registerUserOnChain function which uses the relayer wallet
            return await this.registerUserOnChain(ethAddress, username, typeOfUser);
        } catch (error: any) {
            log(`Failed to register user: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async registerUserOnChain(userAddress: string, username: string, role: string) {
        try {
            // Ensure address is in ETH format
            const ethUserAddress = userAddress.replace('xdc', '0x');
            log(`Registering user address: ${ethUserAddress}`, "blockchain");
            
            // Get current gas price from network
            const networkGasPrice = await this.provider.getFeeData();
            // Use 20% higher than current gas price to ensure acceptance
            const gasPrice = networkGasPrice.gasPrice! * BigInt(120) / BigInt(100);
            
            log(`Network gas price: ${ethers.formatUnits(networkGasPrice.gasPrice!, 'gwei')} gwei`, "blockchain");
            log(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`, "blockchain");
            
            // Call contract method directly using relayer wallet
            const tx = await this.contract.registerUser.populateTransaction(
                ethUserAddress,
                username,
                role
            );

            // Create and send transaction
            const unsignedTx = {
                to: this.contract.target,
                data: tx.data,
                gasPrice: gasPrice,
                gasLimit: BigInt(300000),
                chainId: 50 // XDC Apothem chainId
            };

            // Get nonce
            const nonce = await this.provider.getTransactionCount(this.relayerWallet.address);
            (unsignedTx as any)['nonce'] = nonce;

            // Check relayer balance
            const relayerBalance = await this.provider.getBalance(this.relayerWallet.address);
            const estimatedCost = gasPrice * unsignedTx.gasLimit;
            
            log(`Relayer balance: ${ethers.formatEther(relayerBalance)} XDC`, "blockchain");
            log(`Estimated cost: ${ethers.formatEther(estimatedCost)} XDC`, "blockchain");
            
            if (relayerBalance < estimatedCost) {
                throw new Error(`Insufficient relayer balance. Need ${ethers.formatEther(estimatedCost)} XDC, have ${ethers.formatEther(relayerBalance)} XDC`);
            }

            const response = await this.relayerWallet.sendTransaction(unsignedTx);
            log(`Transaction sent: ${response.hash}`, "blockchain");
            
            const receipt = await response.wait();
            if (receipt) {
                log(`Transaction confirmed in block ${receipt.blockNumber}`, "blockchain");
            } else {
                log(`Transaction confirmed but receipt was null`, "blockchain");
            }

            return receipt;
        } catch (error: any) {
            log(`Failed to register user: ${error.message}`, "blockchain");
            throw error;
        }
    }

    // Helper method to get user's wallet reference ID
    private async getUserWalletReferenceId(userId: number): Promise<string> {
        try {
            // Get user wallet from storage
            const user = await storage.getUserById(userId);
            if (!user || !user.walletReferenceId) {
                throw new Error('User wallet not found');
            }
            
            return user.walletReferenceId;
        } catch (error: any) {
            log(`Failed to get user wallet reference ID: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async addPoolManager(repoId: number, poolManager: string, username: string, githubId: number, userId: number): Promise<ethers.TransactionReceipt | null> {
        try {
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (!user.xdcWalletAddress) {
                throw new Error('User wallet address not found');
            }
            
            log(`Adding pool manager ${username} (${poolManager}) using meta-transaction`, "blockchain");
            
            // Create contract interface for function encoding
            const contractInterface = new ethers.Interface(RepoRewardsABI);
            
            // Encode function data for addPoolManager
            const addManagerData = contractInterface.encodeFunctionData(
                'addPoolManager', 
                [repoId, poolManager, username, githubId]
            );
            
            // Prepare meta-transaction
            const { request, signature } = await this.prepareMetaTransaction(
                userId,
                this.contract.target as string,
                addManagerData,
                BigInt(200000)
            );
            
            // Execute meta-transaction using relayer's wallet (pays for gas)
            log(`Sending addPoolManager meta-transaction for repository ${repoId}`, "blockchain");
            const tx = await this.executeMetaTransaction(request, signature, BigInt(400000));
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new Error('Transaction failed');
            }
            
            log(`Pool manager added. TX: ${tx.hash}`, "blockchain");
            return receipt;
        } catch (error: any) {
            log(`Failed to add pool manager: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async allocateIssueReward(
        repoId: number,
        issueId: number,
        reward: string,
        userId: number
    ): Promise<AllocateRewardResponse> {
        try {
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (!user.xdcWalletAddress) {
                throw new Error('User wallet address not found');
            }
            
            // The address of the user's wallet (converted to ETH format)
            const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
            
            // Convert reward to wei
            const rewardBigInt = ethers.parseEther(reward);
            
            // Check if user needs gas and subsidize if necessary
            log(`Ensuring user ${user.username} (${userAddress}) has enough XDC for allocateIssueReward transaction`, "blockchain");
            const gasWasSubsidized = await this.ensureUserHasGas(userAddress);
            
            if (gasWasSubsidized) {
                // If we just subsidized the user, add a short delay to ensure network state is updated
                log(`Gas was subsidized, waiting for network to stabilize...`, "blockchain");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Get user's wallet to send the transaction
            if (!user.walletReferenceId) {
                throw new Error('User wallet reference ID not found');
            }
            
            const userPrivateKey = await this.getWalletSecret(user.walletReferenceId);
            const userWallet = new ethers.Wallet(userPrivateKey.privateKey, this.provider);
            
            // Create contract interface with the user's wallet and cast to the specific type
            const contractWithSigner = this.contract.connect(userWallet) as ExtendedContract;
            
            // Get current network gas price and increase it to ensure transaction is accepted
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice! * BigInt(120) / BigInt(100); // 20% higher
            
            // Log XDC amount
            log(`Allocating reward of ${reward} XDC for issue ${issueId} in repo ${repoId}`, "blockchain");
            
            // Use contract interface to encode function data directly
            const contractInterface = new ethers.Interface(RepoRewardsABI);
            const data = contractInterface.encodeFunctionData(
                'allocateIssueReward',
                [repoId, issueId, rewardBigInt]
            );
            
            // Estimate gas with buffer for safety
            const estimatedGas = await this.provider.estimateGas({
                from: userWallet.address,
                to: this.contract.target,
                data: data,
                gasPrice
            });
            const safeGasLimit = estimatedGas * BigInt(130) / BigInt(100); // 30% buffer
            
            // Create transaction object
            const transactionRequest = {
                to: this.contract.target,
                data: data,
                gasPrice: gasPrice,
                gasLimit: safeGasLimit
            };
            
            // Send transaction with optimized gas parameters
            log(`Sending allocateIssueReward transaction with gasPrice: ${ethers.formatUnits(gasPrice, 'gwei')} gwei, gasLimit: ${safeGasLimit}`, "blockchain");
            const tx = await userWallet.sendTransaction(transactionRequest);
            
            // Wait for transaction confirmation
            log(`Waiting for allocateIssueReward transaction to be confirmed...`, "blockchain");
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new Error('Transaction failed');
            }
            
            log(`Reward allocated. TX: ${tx.hash}`, "blockchain");
            
            return {
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error: any) {
            // Log XDC error context
            log(`Failed to allocate XDC reward: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async addFundToRepository(repoId: number, amountXdc: string, userId?: number): Promise<ethers.TransactionResponse> {
        try {
            const amountWei = ethers.parseEther(amountXdc); // Amount is now XDC
            
            if (!userId) {
                throw new Error('User ID is required');
            }
            
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (user.role !== 'poolmanager') {
                throw new Error('Only pool managers can add funds');
            }
            
            if (!user.xdcWalletAddress || !user.walletReferenceId) {
                throw new Error('User wallet address or reference ID not found');
            }
            
            const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
            log(`User ${user.username} (ID: ${userId}) is adding ${amountXdc} XDC to repository ${repoId}`, "blockchain");
            
            // Ensure user has enough XDC for gas (the funding amount will be sent separately)
            log(`Ensuring user ${user.username} (${userAddress}) has enough XDC for gas for addFundToRepository transaction`, "blockchain");
            const gasWasSubsidized = await this.ensureUserHasGas(user.xdcWalletAddress, amountXdc);
            if (gasWasSubsidized) {
                log(`Gas was subsidized for user ${user.username}, waiting 5s...`, "blockchain");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Get user's wallet to send the transaction
            const userPrivateKey = await this.getWalletSecret(user.walletReferenceId);
            const userWallet = new ethers.Wallet(userPrivateKey.privateKey, this.provider);
            
            // Create contract interface with the user's wallet and cast to the specific type
            const contractWithSigner = this.contract.connect(userWallet) as ExtendedContract;
            
            // Get current network gas price and increase it to ensure transaction is accepted
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice! * BigInt(120) / BigInt(100); // 20% higher
            
            // Estimate gas using getFunction
            const estimateGasFunc = contractWithSigner.getFunction('addFundToRepository');
            const estimatedGas = await estimateGasFunc.estimateGas(repoId, { value: amountWei });
            const safeGasLimit = estimatedGas * BigInt(130) / BigInt(100); // 30% buffer

            // Call addFundToRepository directly from the user's wallet,
            // sending the XDC amount in the 'value' field.
            log(`User ${user.username} calling addFundToRepository for repository ${repoId} with ${amountXdc} XDC`, "blockchain");
            const txResponse: ethers.TransactionResponse = await contractWithSigner.addFundToRepository(repoId, {
                value: amountWei, // Send XDC native token
                gasPrice: gasPrice,
                gasLimit: safeGasLimit
            });

            // Wait for transaction confirmation (wait on the response, not the receipt initially)
            const receipt = await txResponse.wait(); // Returns TransactionReceipt | null

            if (!receipt) {
                throw new Error('Transaction failed to confirm');
            }

            log(`Funds added to repository ${repoId}. Amount: ${amountXdc} XDC. TX: ${txResponse.hash}`, "blockchain");

            // Record transaction trace for security and audit (use txResponse.hash)
            await this.recordTransactionTrace(
                userId,
                'fund_repository',
                repoId,
                txResponse.hash,
                {
                    amountXdc: amountXdc, // Log XDC amount
                    userAddress: user.xdcWalletAddress,
                    timestamp: new Date().toISOString()
                }
            );

            return txResponse; // Return the TransactionResponse
        } catch (error) {
            log(`Error in addFundToRepository: ${error}`, "blockchain");
            throw error;
        }
    }

    /**
     * Approve tokens to be spent by the contract
     * This allows the contract to transfer tokens from the user's wallet
     * Uses the relayer wallet to pay for gas fees
     */
    // Import required functions from transactionService
    private async getWalletSecret(walletReferenceId: string): Promise<{ privateKey: string }> {
        try {
            // Use the transactionService to get the wallet secret
            return await transactionService.getWalletSecret(walletReferenceId);
        } catch (error) {
            console.error('Error getting wallet secret:', error);
            throw new Error('Failed to retrieve wallet secret');
        }
    }

    // Create a reusable function for preparing meta-transactions
    private async prepareMetaTransaction(
        userId: number,
        targetContract: string,
        data: string,
        gasEstimate: bigint = BigInt(300000)
    ): Promise<{request: any, signature: string}> {
        // Get user information
        const user = await storage.getUserById(userId);
        if (!user || !user.xdcWalletAddress || !user.walletReferenceId) {
            throw new Error('User details not found');
        }
        
        const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
        
        // Get user's wallet to sign
        const userPrivateKey = await this.getWalletSecret(user.walletReferenceId);
        const userWallet = new ethers.Wallet(userPrivateKey.privateKey);
        
        // Create ForwardRequest structure
        const forwardRequest = {
            from: userAddress,
            to: targetContract,
            value: 0,
            gas: gasEstimate,
            nonce: await this.forwarderContract.getNonce(userAddress),
            data: data
        };
        
        // Sign the request with user's wallet
        const domain = {
            name: 'CustomForwarder',
            version: '0.0.1',
            chainId: 50,
            verifyingContract: this.forwarderContract.target as string
        };
        
        const types = {
            ForwardRequest: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'gas', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'data', type: 'bytes' }
            ]
        };
        
        const signature = await userWallet.signTypedData(domain, types, forwardRequest);
        
        return { request: forwardRequest, signature };
    }

    /**
     * Checks if a user has enough XDC for gas and transaction amount
     * @param userAddress The user's wallet address
     * @param transactionAmount The amount being sent in the transaction (in XDC string format)
     * @param minGasAmount The minimum amount of XDC the user should have for gas (in XDC)
     */
    async ensureUserHasGas(userAddress: string, transactionAmount: string = "0", minGasAmount: string = "0.005"): Promise<boolean> {
        try {
            // Convert to ETH format if it's in XDC format
            const ethUserAddress = userAddress.replace('xdc', '0x');
            
            // Get user's current balance
            const currentBalance = await this.provider.getBalance(ethUserAddress);
            const minGasAmountWei = ethers.parseEther(minGasAmount);
            
            // Convert transaction amount to wei if provided
            let transactionAmountWei = BigInt(0);
            if (transactionAmount && transactionAmount !== "0") {
                transactionAmountWei = ethers.parseEther(transactionAmount);
            }
            
            // Total required = transaction amount + gas
            const totalRequired = transactionAmountWei + minGasAmountWei;
            
            log(`User ${ethUserAddress} has ${ethers.formatEther(currentBalance)} XDC`, "blockchain");
            log(`Transaction requires: ${transactionAmount} XDC + ${minGasAmount} XDC gas = ${ethers.formatEther(totalRequired)} XDC total`, "blockchain");
            
            // Check if user has enough XDC for transaction + gas
            if (currentBalance >= totalRequired) {
                log(`User has enough XDC for transaction + gas (${ethers.formatEther(currentBalance)} XDC available)`, "blockchain");
                return false; // No subsidy needed
            }
            
            // User doesn't have enough XDC - provide clear error message
            if (currentBalance < minGasAmountWei) {
                // Not enough even for gas
                const errorMsg = `Insufficient XDC balance. You need at least ${minGasAmount} XDC for transaction fees. Please add more XDC to your wallet and try again.`;
                log(errorMsg, "blockchain");
                throw new Error(errorMsg);
            } else {
                // Has gas but not enough for transaction + gas
                const maxPossibleSend = ethers.formatEther(currentBalance - minGasAmountWei);
                const errorMsg = `Insufficient XDC balance for this transaction. You have ${ethers.formatEther(currentBalance)} XDC, but need to keep at least ${minGasAmount} XDC for gas fees. The maximum you can send is ${maxPossibleSend} XDC.`;
                log(errorMsg, "blockchain");
                throw new Error(errorMsg);
            }
            
        } catch (error: any) {
            log(`Failed to check user gas: ${error.message}`, "blockchain");
            throw error;
        }
    }

    // Execute a meta-transaction
    private async executeMetaTransaction(
        request: any,
        signature: string,
        gasLimit: bigint = BigInt(500000)
    ): Promise<ethers.TransactionResponse> {
        // Create the forwarder interface
        const forwarderInterface = new ethers.Interface(CustomForwarderABI);
        
        // Encode the execute function call
        const data = forwarderInterface.encodeFunctionData(
            'execute',
            [request, signature]
        );
        
        // Create transaction request
        const unsignedTx = {
            to: this.forwarderContract.target as string,
            data: data,
            gasLimit: Number(gasLimit), // Convert BigInt to number for compatibility
            chainId: 50 // XDC Apothem chainId
        };
        
        // Sign and send transaction using relayer wallet
        const tx = await this.relayerWallet.sendTransaction(unsignedTx);
        
        // Return the transaction response which has all the methods and properties we need
        return tx;
    }

    async approveTokensForContract(amount: string, userId: number): Promise<ethers.TransactionResponse> {
        try {
            const amountWei = ethers.parseEther(amount);
            
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (!user.xdcWalletAddress) {
                throw new Error('User wallet address not found');
            }
            
            // The address of the user's tokens (converted to ETH format)
            const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
            
            // Check if user needs gas and subsidize if necessary
            log(`Ensuring user ${user.username} (${userAddress}) has enough XDC for approval transaction`, "blockchain");
            const gasWasSubsidized = await this.ensureUserHasGas(userAddress);
            
            if (gasWasSubsidized) {
                // If we just subsidized the user, add a short delay to ensure network state is updated
                log(`Gas was subsidized, waiting for network to stabilize...`, "blockchain");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Get user's wallet to send the approve transaction
            if (!user.walletReferenceId) {
                throw new Error('User wallet reference ID not found');
            }
            
            const userPrivateKey = await this.getWalletSecret(user.walletReferenceId);
            const userWallet = new ethers.Wallet(userPrivateKey.privateKey, this.provider);
            
            // The contract address that will be approved to spend tokens
            const spenderAddress = this.contract.target as string;
            
            log(`User ${user.username} approving ${amount} ROXN tokens for contract`, "blockchain");
            
            // Create token contract interface with the user's wallet
            const tokenContractInterface = new ethers.Interface(ROXNTokenABI);
            const tokenContractWithSigner = new ethers.Contract(
                this.tokenContract.target as string,
                tokenContractInterface,
                userWallet
            );
            
            // Get current network gas price and increase it to ensure transaction is accepted
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice! * BigInt(120) / BigInt(100); // 20% higher
            
            // Estimate gas with buffer for safety
            const estimatedGas = await tokenContractWithSigner.approve.estimateGas(spenderAddress, amountWei);
            const safeGasLimit = estimatedGas * BigInt(130) / BigInt(100); // 30% buffer
            
            // Call approve method directly using user's wallet with explicit gas parameters
            log(`Sending approval transaction with gasPrice: ${ethers.formatUnits(gasPrice, 'gwei')} gwei, gasLimit: ${safeGasLimit}`, "blockchain");
            const tx = await tokenContractWithSigner.approve(spenderAddress, amountWei, {
                gasPrice,
                gasLimit: safeGasLimit
            });
            
            // Wait for transaction confirmation
            log(`Waiting for approval transaction to be confirmed...`, "blockchain");
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new Error('Transaction failed');
            }
            
            log(`Token approval completed. TX: ${tx.hash}`, "blockchain");
            
            return tx;
        } catch (error) {
            log(`Error in approveTokensForContract: ${error}`, "blockchain");
            throw error;
        }
    }

    async distributeReward(repoId: number, issueId: number, contributorAddress: string, userId: number): Promise<ethers.TransactionReceipt | null> {
        try {
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (!user.xdcWalletAddress) {
                throw new Error('User wallet address not found');
            }
            
            // The address of the user's wallet (converted to ETH format)
            const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
            
            // Convert contributor address to ETH format if needed
            const ethContributorAddress = contributorAddress.replace('xdc', '0x');
            log(`Converting contributor address from ${contributorAddress} to ${ethContributorAddress}`, "blockchain");
            
            // Check if user needs gas and subsidize if necessary
            log(`Ensuring user ${user.username} (${userAddress}) has enough XDC for distributeReward transaction`, "blockchain");
            const gasWasSubsidized = await this.ensureUserHasGas(userAddress);
            
            if (gasWasSubsidized) {
                // If we just subsidized the user, add a short delay to ensure network state is updated
                log(`Gas was subsidized, waiting for network to stabilize...`, "blockchain");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Get user's wallet to send the transaction
            if (!user.walletReferenceId) {
                throw new Error('User wallet reference ID not found');
            }
            
            const userPrivateKey = await this.getWalletSecret(user.walletReferenceId);
            const userWallet = new ethers.Wallet(userPrivateKey.privateKey, this.provider);
            
            // Create contract interface for direct function call
            const contractInterface = new ethers.Interface(RepoRewardsABI);
            const data = contractInterface.encodeFunctionData(
                'distributeReward', 
                [repoId, issueId, ethContributorAddress]
            );
            
            // Get current network gas price and increase it to ensure transaction is accepted
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice! * BigInt(120) / BigInt(100); // 20% higher
            
            // Estimate gas with buffer for safety
            const estimatedGas = await this.provider.estimateGas({
                from: userWallet.address,
                to: this.contract.target,
                data: data,
                gasPrice
            });
            const safeGasLimit = estimatedGas * BigInt(130) / BigInt(100); // 30% buffer
            
            // Create transaction object
            const transactionRequest = {
                to: this.contract.target,
                data: data,
                gasPrice: gasPrice,
                gasLimit: safeGasLimit
            };
            
            // Send transaction with optimized gas parameters
            log(`Sending distributeReward transaction with gasPrice: ${ethers.formatUnits(gasPrice, 'gwei')} gwei, gasLimit: ${safeGasLimit}`, "blockchain");
            const tx = await userWallet.sendTransaction(transactionRequest);
            
            // Wait for transaction confirmation
            log(`Waiting for distributeReward transaction to be confirmed...`, "blockchain");
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new Error('Transaction failed');
            }
            
            log(`XDC Reward distributed. TX: ${tx.hash}`, "blockchain");
            return receipt;
        } catch (error: any) {
            log(`Failed to distribute XDC reward: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async getPoolManager(walletAddress: string): Promise<any> {
        return await this.contract.getPoolManager(walletAddress);
    }

    async getContributor(walletAddress: string): Promise<any> {
        return await this.contract.getContributor(walletAddress);
    }

    async getRepository(repoId: number): Promise<Repository> {
        try {
            const [poolManagers, contributors, poolRewards, issues] = await this.contract.getRepository(repoId);
            
            log(`Repository ${repoId} pool managers from contract: ${poolManagers.join(', ')}`, "blockchain");
            
            // Convert BigInt values to strings and format issues
            const formattedIssues: IssueReward[] = issues.map((issue: any) => ({
                issueId: issue.issueId.toString(),
                rewardAmount: issue.rewardAmount.toString(),
                status: issue.status,
                rewardInEther: ethers.formatEther(issue.rewardAmount)
            }));

            return {
                poolManagers,
                contributors,
                poolRewards: poolRewards.toString(),
                issues: formattedIssues
            };
        } catch (error: any) {
            log(`Failed to get repository: ${error.message}`, "blockchain");
            throw error;
        }
    }

    async getIssueRewards(repoId: number, issueIds: number[]): Promise<string[]> {
        try {
            // Improved logging with simpler output (avoid stringifying complex objects)
            log(`Calling contract.getIssueRewards for repoId: ${repoId}, issueIds: ${issueIds.join(',')}`, "blockchain");
            log(`Contract target address: ${this.contract.target}`, "blockchain");

            // Add a timeout to the promise to prevent hanging if the RPC doesn't respond
            const timeoutPromise = new Promise<bigint[]>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('RPC call timed out after 10 seconds'));
                }, 10000);
            });

            // Try a direct RPC call with more specific error handling
            try {
                // Create contract interface for direct function call (alternative approach)
                const contractInterface = new ethers.Interface(RepoRewardsABI);
                const data = contractInterface.encodeFunctionData('getIssueRewards', [repoId, issueIds]);
                
                // Make a direct call with timeout race
                const result = await Promise.race([
                    this.provider.call({
                        to: this.contract.target as string,
                        data
                    }),
                    timeoutPromise
                ]);

                // Decode the result
                if (result && result !== '0x') {
                    const decodedResult = contractInterface.decodeFunctionResult('getIssueRewards', result as string);
                    const rewards = decodedResult[0];
                    log(`Successfully received rewards from contract: ${rewards.map((r: bigint) => r.toString()).join(',')}`, "blockchain");
                    return rewards.map((reward: bigint) => reward.toString());
                }
                
                // If result is empty, return empty array with appropriate length
                log(`Empty result from contract, returning zeros`, "blockchain");
                return Array(issueIds.length).fill('0');
            } catch (directCallError: any) {
                // Log the direct call error clearly
                const errorMsg = directCallError.message || 'Unknown error';
                log(`Direct RPC call failed: ${errorMsg}`, "blockchain");
                throw directCallError;
            }
        } catch (error: any) {
            // Safe logging without any JSON.stringify to avoid BigInt issues
            const errorMsg = error.message || 'Unknown error';
            const errorCode = error.code || 'NO_CODE';
            
            log(`Failed to get issue rewards. Error: ${errorMsg}, Code: ${errorCode}`, "blockchain");
            
            // Return zeros for each requested issue ID rather than throwing
            return Array(issueIds.length).fill('0');
        }
    }

    async checkUserType(userAddress: string): Promise<[string, string]> {
        return await this.contract.checkUserType(userAddress);
    }

    async getUserWalletByUsername(username: string): Promise<string> {
        return await this.contract.getUserWalletByUsername(username);
    }

    async getRepositoryRewards(repoIds: number[]): Promise<bigint[]> {
        return await this.contract.getRepositoryRewards(repoIds);
    }

    async getUserRole(address: string): Promise<string> {
        try {
            const role = await this.contract.getUserRole(address);
            return role;
        } catch (error) {
            log(`Error getting user role: ${error}`, "blockchain");
            throw error;
        }
    }

    async getPoolManagers(): Promise<string[]> {
        try {
            const managers = await this.contract.getPoolManagers();
            return managers;
        } catch (error) {
            log(`Error getting pool managers: ${error}`, "blockchain");
            throw error;
        }
    }

    async getWalletInfo(userId: string | number) {
        try {
            log(`Fetching wallet info for user ${userId}`, "blockchain");
            const wallet = await storage.getWallet(userId.toString());
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            // Validate wallet address format
            if (!wallet.address || typeof wallet.address !== 'string' || !wallet.address.startsWith('xdc')) {
                log(`Invalid wallet address format detected for user ${userId}`, 'blockchain');
                throw new Error('Invalid wallet address format');
            }
            
            // Convert XDC address to ETH format
            const ethAddress = wallet.address.replace('xdc', '0x');
            
            // Direct RPC call to get balance - more reliable than provider.getBalance()
            const balanceHex = await this.provider.send("eth_getBalance", [ethAddress, "latest"]);
            const balance = BigInt(balanceHex || "0x0");
            
            log(`Address: ${ethAddress}, Balance: ${balance.toString()}`, "blockchain");
            
            // Attempt to get token balance but handle errors gracefully
            let tokenBalance = BigInt(0);
            try {
                tokenBalance = await this.getTokenBalance(wallet.address);
            } catch (tokenError) {
                log(`Error getting token balance: ${tokenError}`, "blockchain");
                // Token balance remains 0 if there's an error
            }
            
            return {
                address: wallet.address,
                balance: balance,
                tokenBalance: tokenBalance
            };
        } catch (error: any) {
            log(`Failed to get wallet info: ${error.message}`, "blockchain");
            // Return empty wallet with zero balances
            return {
                address: "",
                balance: BigInt(0),
                tokenBalance: BigInt(0)
            };
        }
    }

    /**
     * Gets recent transactions for a user wallet
     * @param userId User ID to fetch transactions for
     * @param limit Maximum number of transactions to return
     * @returns Array of transactions with hash, timestamp, value, and confirmation status
     */
    /**
     * Gets recent transactions for a user wallet
     * @param userId User ID to fetch transactions for
     * @param limit Maximum number of transactions to return
     * @returns Array of transactions with hash, timestamp, value, and confirmation status
     */
    async getRecentTransactions(userId: string | number, limit: number = 10): Promise<Transaction[]> {
        try {
            log(`Getting recent transactions for user ${userId}`, "blockchain");
            const wallet = await storage.getWallet(userId.toString());
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            // Validate wallet address format
            if (!wallet.address || typeof wallet.address !== 'string' || !wallet.address.startsWith('xdc')) {
                log(`Invalid wallet address format detected for user ${userId}`, 'blockchain');
                throw new Error('Invalid wallet address format');
            }
            
            const ethAddress = wallet.address.replace('xdc', '0x');
            
            // Get current block number to calculate confirmations
            const currentBlock = await this.provider.getBlockNumber();
            
            // XDC doesn't have native support for fetching transaction history
            // We would typically use an explorer API or an indexing service
            // For this implementation, we'll use a limited scan to get recent transactions
            
            const transactions: Transaction[] = [];
            
            // Scan the last 100 blocks to better capture recent transactions
            // This will improve the chances of finding transactions for users
            const blocksToScan = Math.min(100, currentBlock);
            
            // Set a longer timeout to allow more thorough scanning
            const timeout = 30000; // 30 seconds
            const scanTimeout = setTimeout(() => {
                log(`Transaction scan timed out after ${timeout}ms`, "blockchain");
            }, timeout);
            
            try {
                // Use Promise.all with a smaller batch to prevent timeouts
                const promises = [];
                
                for (let i = 0; i < blocksToScan && transactions.length < limit; i++) {
                    const blockNumber = currentBlock - i;
                    promises.push((async () => {
                        try {
                            // Only get block headers without full transaction data to reduce load
                            const block = await this.provider.getBlock(blockNumber);
                            
                            if (!block || !block.transactions || block.transactions.length === 0) {
                                return; // Skip empty blocks
                            }
                            
                            // Check up to 20 transactions in each block to improve capture rate
                            const txsToCheck = block.transactions.slice(0, 20);
                            
                            for (const txHash of txsToCheck) {
                                if (typeof txHash !== 'string') continue;
                                
                                try {
                                    const tx = await this.provider.getTransaction(txHash);
                                    
                                    // Skip if transaction couldn't be retrieved
                                    if (!tx) continue;
                                    
                                    // Check if the transaction involves our address
                                    const txTo = tx.to ? tx.to.toLowerCase() : '';
                                    const txFrom = tx.from ? tx.from.toLowerCase() : '';
                                    
                                    if (txTo === ethAddress.toLowerCase() ||
                                        txFrom === ethAddress.toLowerCase()) {
                                        
                                        const txValue = tx.value ? tx.value.toString() : '0';
                                        
                                        const txDetails: Transaction = {
                                            hash: tx.hash,
                                            blockNumber: block.number,
                                            from: tx.from || '',
                                            to: tx.to || '',
                                            value: txValue,
                                            timestamp: block.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString(),
                                            confirmations: currentBlock - block.number + 1,
                                            isIncoming: txTo === ethAddress.toLowerCase(),
                                            status: (currentBlock - block.number + 1) >= 12 ? 'confirmed' as const : 'pending' as const
                                        };
                                        
                                        transactions.push(txDetails);
                                        
                                        if (transactions.length >= limit) {
                                            return; // Exit early if we have enough transactions
                                        }
                                    }
                                } catch (txError) {
                                    // Just log and continue with next transaction
                                    log(`Error processing transaction ${txHash}: ${txError}`, "blockchain");
                                }
                            }
                        } catch (blockError) {
                            log(`Error scanning block ${blockNumber}: ${blockError}`, "blockchain");
                        }
                    })());
                }
                
                // Wait for all block processing to complete or time out
                await Promise.race([
                    Promise.all(promises),
                    new Promise(resolve => setTimeout(resolve, timeout - 500))
                ]);
            } finally {
                clearTimeout(scanTimeout);
            }
            
            return transactions;
        } catch (error: any) {
            log(`Failed to get recent transactions: ${error.message}`, "blockchain");
            return [];
        }
    }
    
    /**
     * Records a transaction trace log for security and audit purposes
     * @param userId User ID performing the transaction
     * @param action Description of the action (e.g., 'fund_repository', 'distribute_reward')
     * @param repoId Repository ID involved (if applicable)
     * @param txHash Transaction hash (if available)
     * @param data Additional data to log
     */
    async recordTransactionTrace(
        userId: number, 
        action: string, 
        repoId: number | null = null,
        txHash: string | null = null,
        data: Record<string, any> = {}
    ): Promise<void> {
        try {
            // Get current timestamp for the log
            const timestamp = new Date().toISOString();
            
            // Build log entry
            const logEntry = {
                timestamp,
                userId,
                action,
                repoId,
                txHash,
                ...data
            };
            
            // Log to console in structured format for audit trail
            log(`[AUDIT] ${JSON.stringify(logEntry)}`, 'blockchain');
            
            // In production, you might want to store this in a database table
            // or send to a monitoring service
            
            // For this implementation, we'll rely on server logs which can be
            // cross-referenced with xdcscan.io for transaction verification
        } catch (error) {
            // Non-blocking error handling - just log the error but don't throw
            log(`Error recording transaction trace: ${error}`, 'blockchain');
        }
    }
    
    /**
     * Gets the token balance for an address
     */
    async getTokenBalance(address: string): Promise<bigint> {
        try {
            const ethAddress = address.replace('xdc', '0x');
            log(`Getting token balance for ${ethAddress}`, "blockchain");
            
            // Check if contract is properly initialized
            if (!this.tokenContract) {
                log("Token contract not initialized", "blockchain");
                return BigInt(0);
            }
            
            // Try direct RPC call first
            try {
                const data = this.tokenContract.interface.encodeFunctionData('balanceOf', [ethAddress]);
                const result = await this.provider.call({
                    to: this.tokenContract.target as string,
                    data
                });
                
                if (result && result !== '0x') {
                    const decodedResult = this.tokenContract.interface.decodeFunctionResult('balanceOf', result);
                    return decodedResult[0];
                }
                log("Empty result from token contract, returning 0", "blockchain");
                return BigInt(0);
            } catch (rpcError) {
                log(`RPC error getting token balance: ${rpcError}`, "blockchain");
                return BigInt(0);
            }
        } catch (error) {
            log(`Error in getTokenBalance: ${error}`, "blockchain");
            return BigInt(0);
        }
    }
    
    /**
     * Gets the token contract instance
     */
    getTokenContract(): TokenContract {
        return this.tokenContract;
    }
    
    /**
     * Gets a user wallet instance
     */
    getUserWallet(userAddress: string): ethers.Wallet {
        if (!this.userWallets.has(userAddress)) {
            // Create a new wallet for this user
            const privateKey = this.generatePrivateKeyForUser(userAddress);
            const wallet = new ethers.Wallet(privateKey, this.provider);
            this.userWallets.set(userAddress, wallet);
        }
        return this.userWallets.get(userAddress)!;
    }
    
    /**
     * Generates a deterministic private key for a user (for demo purposes only)
     * In production, this should be securely managed
     */
    private generatePrivateKeyForUser(userAddress: string): string {
        // This is just for demo purposes - in production, use a proper key management system
        const hash = ethers.keccak256(ethers.toUtf8Bytes(userAddress + config.privateKeySecret));
        return hash;
    }

    /**
     * Mints tokens to a user's database balance (for testing purposes)
     * In production, this would be a proper token minting process
     */
    async mintTokensToUser(userId: number, amount: string): Promise<any> {
        try {
            // Convert amount to a bigint (tokens use 18 decimals like ether)
            const amountInWei = ethers.parseEther(amount);
            
            // Update user's token balance in database (this is just for demo purposes)
            // In production, this would be a proper token minting process
            await storage.updateUserTokenBalance(userId, Number(ethers.formatEther(amountInWei)));
            
            return { success: true, message: `Minted ${amount} tokens to user ${userId}` };
        } catch (error) {
            console.error('Error minting tokens:', error);
            throw new Error('Failed to mint tokens');
        }
    }
    
    /**
     * Send XDC from a user's wallet to an external address
     * @param userId ID of the user sending funds
     * @param recipientAddress XDC address of the recipient (with xdc prefix)
     * @param amount Amount to send in wei (as BigInt)
     * @returns Transaction response with hash and confirmation details
     */
    async sendFunds(userId: string | number, recipientAddress: string, amount: bigint): Promise<ethers.TransactionResponse> {
        try {
            // Get user wallet reference ID
            const walletReferenceId = await this.getUserWalletReferenceId(Number(userId));
            
            // Get user's wallet private key
            const { privateKey } = await this.getWalletSecret(walletReferenceId);
            
            // Create user wallet instance
            const userWallet = new ethers.Wallet(privateKey, this.provider);
            
            // Get current gas price and increase it slightly for faster confirmation
            const gasPrice = await this.provider.getFeeData();
            const adjustedGasPrice = gasPrice.gasPrice ? gasPrice.gasPrice * BigInt(110) / BigInt(100) : undefined; // 10% increase
            
            // Prepare transaction parameters
            const nonce = await this.provider.getTransactionCount(userWallet.address);
            
            // Normalize recipient address (ensure it has xdc prefix)
            let normalizedRecipient = recipientAddress;
            
            // If address starts with xdc, convert to 0x format for ethers.js
            if (normalizedRecipient.startsWith('xdc')) {
                normalizedRecipient = '0x' + normalizedRecipient.substring(3);
            }
            
            // Estimate gas
            const gasLimit = await this.provider.estimateGas({
                from: userWallet.address,
                to: normalizedRecipient,
                value: amount
            });
            
            // Add 20% buffer to gas limit for safety
            const safeGasLimit = gasLimit * BigInt(120) / BigInt(100);
            
            // Log the transaction details (masked for security)
            log(`Sending ${ethers.formatEther(amount)} XDC from ${userWallet.address.substring(0, 6)}...${userWallet.address.substring(userWallet.address.length - 4)} to ${normalizedRecipient.substring(0, 6)}...${normalizedRecipient.substring(normalizedRecipient.length - 4)}`, "blockchain");
            
            // Create and sign transaction
            const tx = await userWallet.sendTransaction({
                to: normalizedRecipient,
                value: amount,
                nonce: nonce,
                gasLimit: safeGasLimit,
                gasPrice: adjustedGasPrice,
                // On XDC network, we use chainId 50 for mainnet and 51 for testnet
                chainId: 50 // XDC Mainnet
            });
            
            // Record transaction in our trace logs
            await this.recordTransactionTrace(
                Number(userId),
                'send_funds',
                null,
                tx.hash,
                {
                    recipient: recipientAddress,
                    amount: ethers.formatEther(amount),
                    gasLimit: safeGasLimit.toString(),
                    gasPrice: adjustedGasPrice ? ethers.formatUnits(adjustedGasPrice, 'gwei') : 'default'
                }
            );
            
            // Log transaction hash
            log(`Transaction submitted with hash: ${tx.hash}`, "blockchain");
            
            return tx;
        } catch (error) {
            log(`Error in sendFunds: ${error}`, "blockchain");
            throw error;
        }
    }

    // Send 1 XDC reward for completing social media engagement
    async sendSocialReward(userId: number): Promise<string> {
        try {
            // Get user information
            const user = await storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            if (!user.xdcWalletAddress) {
                throw new Error('User wallet address not found');
            }
            
            // The address of the user's wallet (converted to ETH format)
            const userAddress = user.xdcWalletAddress.replace('xdc', '0x');
            
            // The amount to send (1 XDC)
            const rewardAmount = "1.0";
            
            // Get current gas price from network
            const networkGasPrice = await this.provider.getFeeData();
            // Use 20% higher than current gas price to ensure acceptance
            const gasPrice = networkGasPrice.gasPrice! * BigInt(120) / BigInt(100);
            
            // Standard gas limit for simple transfer
            const gasLimit = BigInt(21000);
            
            // Check relayer balance
            const relayerBalance = await this.provider.getBalance(this.relayerWallet.address);
            const amountWei = ethers.parseEther(rewardAmount);
            const estimatedCost = amountWei + (gasPrice * gasLimit);
            
            log(`Relayer balance: ${ethers.formatEther(relayerBalance)} XDC`, "blockchain");
            log(`Estimated cost: ${ethers.formatEther(estimatedCost)} XDC`, "blockchain");
            
            if (relayerBalance < estimatedCost) {
                throw new Error(`Insufficient relayer balance for social reward. Need ${ethers.formatEther(estimatedCost)} XDC, have ${ethers.formatEther(relayerBalance)} XDC`);
            }

            // Send 1 XDC to the user's wallet
            const tx = await this.relayerWallet.sendTransaction({
                to: userAddress,
                value: amountWei,
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });
            
            log(`Social reward transaction sent: ${tx.hash}`, "blockchain");
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction failed to confirm');
            }
            
            log(`Social reward of ${rewardAmount} XDC sent to ${user.username} (${userAddress}). TX: ${tx.hash}`, "blockchain");
            
            return tx.hash;
        } catch (error: any) {
            log(`Failed to send social reward: ${error.message}`, "blockchain");
            throw error;
        }
    }
}

// Create and export a singleton instance of BlockchainService
export const blockchain = new BlockchainService();

export interface PoolManager {
    username: string;
    githubId: bigint;
    wallet: string;
}

export interface Contributor {
    username: string;
    githubId: bigint;
    wallet: string;
}

export interface Issue {
    issueId: bigint;
    rewardAmount: bigint;
    status: string;
}

/**
 * Transaction interface to define the structure of transaction objects
 */
interface Transaction {
    hash: string;
    blockNumber: number;
    from: string;
    to: string;
    value: string;
    timestamp: string;
    confirmations: number;
    isIncoming: boolean;
    status: 'confirmed' | 'pending';
}
