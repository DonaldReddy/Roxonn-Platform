# ROXN Token Migration Guide
**Version**: 1.0.0  
**Date**: 2023-10-15  
**Status**: Draft  

## Table of Contents
- [1. Overview](#1-overview)
- [2. Migration Timeline](#2-migration-timeline)
- [3. Technical Migration Process](#3-technical-migration-process)
  - [3.1 Smart Contract Deployment](#31-smart-contract-deployment)
  - [3.2 Backend Integration](#32-backend-integration)
  - [3.3 Frontend Updates](#33-frontend-updates)
- [4. User Migration Process](#4-user-migration-process)
  - [4.1 Repository Balance Migration](#41-repository-balance-migration)
  - [4.2 User Communication](#42-user-communication)
- [5. Post-Migration Tasks](#5-post-migration-tasks)
- [6. Rollback Plan](#6-rollback-plan)
- [7. FAQ](#7-faq)

## 1. Overview

This migration guide outlines the technical steps required to transition from the native XDC token to the custom ROXN token for the Roxonn platform. This migration aims to enhance the platform's functionality, introduce token economics, and provide greater flexibility for reward distribution.

## 2. Migration Timeline

| Phase | Description | Duration | Start Date | End Date |
|-------|-------------|----------|------------|----------|
| **Planning & Development** | Smart contract development, testing | 4 weeks | YYYY-MM-DD | YYYY-MM-DD |
| **Testnet Deployment** | Deploy to XDC testnet and internal testing | 2 weeks | YYYY-MM-DD | YYYY-MM-DD |
| **Audit** | Smart contract audit by security firm | 3 weeks | YYYY-MM-DD | YYYY-MM-DD |
| **Community Announcement** | Announce migration to users | 1 week | YYYY-MM-DD | YYYY-MM-DD |
| **Deployment Preparation** | Final preparations for mainnet deployment | 1 week | YYYY-MM-DD | YYYY-MM-DD |
| **Mainnet Deployment** | Deploy contracts to XDC mainnet | 1 day | YYYY-MM-DD | YYYY-MM-DD |
| **Migration Execution** | Execute migration of existing balances | 1 week | YYYY-MM-DD | YYYY-MM-DD |
| **Monitoring & Support** | Post-migration monitoring and support | 2 weeks | YYYY-MM-DD | YYYY-MM-DD |

## 3. Technical Migration Process

### 3.1 Smart Contract Deployment

1. **Deploy Token Contracts**
   - Deploy the ROXN token contract (see [TOKEN_SPECIFICATION.md](./TOKEN_SPECIFICATION.md))
   - Deploy supporting contracts (VestingManager, RewardDistributor)
   - Verify all contracts on XDCScan

2. **Deploy Updated RepoRewards Contract**
   - Deploy the modified RepoRewards contract that supports ROXN tokens
   - Set the token address in the contract
   - Verify the contract on XDCScan

3. **Initial Token Distribution**
   - Mint initial token allocations according to tokenomics plan
   - Transfer appropriate amounts to vesting contracts
   - Allocate reward pool tokens

### 3.2 Backend Integration

1. **Update Blockchain Service**
   ```typescript
   // Update server/blockchain.ts
   
   // Add token contract instance
   this.tokenContract = new ethers.Contract(
     config.roxnTokenAddress.replace('xdc', '0x'),
     ROXNTokenABI,
     this.relayerWallet
   );
   
   // Update existing methods to work with tokens
   async addFundToRepository(repoId: number, amount: bigint, userAddress: string): Promise<ethers.ContractTransaction> {
     if (this.isUsingNativeToken()) {
       return this.contract.addFundToRepository(repoId, { value: amount });
     } else {
       // First approve tokens to be spent by RepoRewards contract
       await this.tokenContract.connect(this.getUserWallet(userAddress)).approve(
         this.contract.address,
         amount
       );
       
       // Then call the addFundToRepository function with the amount
       return this.contract.addFundToRepository(repoId, amount);
     }
   }
   ```

2. **Update API Endpoints**
   ```typescript
   // Update server/routes.ts
   
   // Add token balance endpoint
   app.get('/api/token/balance', requireAuth, async (req, res) => {
     try {
       const userAddress = req.user?.xdcWalletAddress;
       if (!userAddress) {
         return res.status(400).json({ error: 'Wallet address not found' });
       }
       
       const balance = await blockchain.getTokenBalance(userAddress);
       res.json({ balance: balance.toString() });
     } catch (error) {
       console.error('Error fetching token balance:', error);
       res.status(500).json({ error: 'Failed to fetch token balance' });
     }
   });
   ```

3. **Add Token Transaction Tracking**
   ```typescript
   // Update server/transactionService.ts
   
   // Add token transfer tracking
   async trackTokenTransfer(txHash: string, from: string, to: string, amount: string): Promise<void> {
     // Implementation to track token transfers
     // Store transaction details in database
   }
   ```

### 3.3 Frontend Updates

1. **Update Web3 Hooks**
   ```typescript
   // Update client/src/hooks/use-blockchain.tsx
   
   const useTokenBalance = (address: string) => {
     const [balance, setBalance] = useState<string>('0');
     const [loading, setLoading] = useState<boolean>(true);
     
     useEffect(() => {
       const fetchBalance = async () => {
         if (!address) return;
         
         try {
           setLoading(true);
           const response = await axios.get('/api/token/balance');
           setBalance(response.data.balance);
         } catch (error) {
           console.error('Error fetching token balance:', error);
         } finally {
           setLoading(false);
         }
       };
       
       fetchBalance();
       
       // Refresh balance every 30 seconds
       const intervalId = setInterval(fetchBalance, 30000);
       return () => clearInterval(intervalId);
     }, [address]);
     
     return { balance, loading };
   };
   ```

2. **Update UI Components**
   ```tsx
   // Update client/src/components/pool-managers.tsx
   
   // Replace XDC balance display with ROXN balance
   const { balance, loading } = useTokenBalance(walletAddress);
   
   return (
     <div className="balance-display">
       <h3>Your ROXN Balance</h3>
       {loading ? (
         <Spinner />
       ) : (
         <p>{ethers.utils.formatUnits(balance, 18)} ROXN</p>
       )}
     </div>
   );
   ```

3. **Update Fund Repository Form**
   ```tsx
   // Update fund repository form to handle token approvals
   
   const handleFundRepository = async (repoId: number, amount: string) => {
     try {
       setLoading(true);
       
       // Convert amount to wei
       const amountInWei = ethers.utils.parseUnits(amount, 18);
       
       // First approve tokens to be spent by RepoRewards contract
       await tokenContract.approve(repoRewardsAddress, amountInWei);
       
       // Then add funds to repository
       await repoRewardsContract.addFundToRepository(repoId, amountInWei);
       
       toast.success('Repository funded successfully');
     } catch (error) {
       console.error('Error funding repository:', error);
       toast.error('Failed to fund repository');
     } finally {
       setLoading(false);
     }
   };
   ```

## 4. User Migration Process

### 4.1 Repository Balance Migration

1. **Create a snapshot of existing repository balances**
   ```typescript
   async function createRepositoryBalanceSnapshot() {
     const repositories = await db.query('SELECT * FROM repositories');
     
     const snapshot = [];
     for (const repo of repositories) {
       const onChainData = await blockchain.getRepository(repo.id);
       snapshot.push({
         repoId: repo.id,
         balance: onChainData.poolRewards.toString(),
         poolManagers: onChainData.poolManagers,
         contributors: onChainData.contributors
       });
     }
     
     // Store snapshot in database
     await db.query('INSERT INTO balance_snapshots (data) VALUES ($1)', [JSON.stringify(snapshot)]);
     
     return snapshot;
   }
   ```

2. **Migrate repository balances**
   ```typescript
   async function migrateRepositoryBalances(snapshot) {
     const tokenContract = blockchain.getTokenContract();
     
     // Mint equivalent ROXN tokens
     for (const repo of snapshot) {
       // Convert XDC balance to ROXN equivalent
       const roxnAmount = repo.balance;
       
       // Mint ROXN tokens to the contract address
       await tokenContract.mint(repoRewardsContract.address, roxnAmount);
       
       // Update repository balance in new contract
       await repoRewardsContract.updateRepositoryBalance(repo.repoId, roxnAmount);
     }
   }
   ```

3. **Verify migration**
   ```typescript
   async function verifyMigration(snapshot) {
     let success = true;
     
     for (const repo of snapshot) {
       const newBalance = await repoRewardsContract.getRepositoryBalance(repo.repoId);
       
       if (newBalance.toString() !== repo.balance) {
         console.error(`Migration failed for repository ${repo.repoId}. Expected: ${repo.balance}, Actual: ${newBalance}`);
         success = false;
       }
     }
     
     return success;
   }
   ```

### 4.2 User Communication

1. **Pre-Migration Announcements**
   - Prepare blog post explaining the transition to ROXN token
   - Create documentation about ROXN token benefits
   - Notify users via email about the upcoming migration

2. **During Migration**
   - Update platform status page with migration progress
   - Temporarily disable certain functions during migration
   - Provide real-time updates via social channels

3. **Post-Migration**
   - Announce completion of migration
   - Provide updated documentation on using ROXN tokens
   - Offer support for any issues related to the migration

## 5. Post-Migration Tasks

1. **Monitor System Performance**
   - Set up metrics for token transactions
   - Monitor gas usage
   - Track user engagement with new token

2. **XSwap Listing**
   - Create ROXN/XDC trading pair on XSwap
   - Provide initial liquidity

3. **Update Documentation**
   - Update API documentation
   - Update user guides
   - Create token-specific documentation

## 6. Rollback Plan

In case of critical issues during migration, a rollback plan is essential:

1. **Revert Contract Updates**
   - Deploy previous version of RepoRewards contract
   - Switch back to native XDC mode
   - Restore repository balances from snapshot

2. **Backend Rollback**
   - Revert blockchain service changes
   - Restore previous API endpoints
   - Disable token-specific features

3. **Frontend Rollback**
   - Revert UI component changes
   - Restore XDC-based displays
   - Update frontend configuration

## 7. FAQ

**Q: Will I lose my existing rewards during migration?**  
A: No, all existing repository balances will be migrated to the equivalent value in ROXN tokens.

**Q: Do I need to do anything to prepare for migration?**  
A: No action is required from users. All balances will be automatically migrated.

**Q: Will my wallet address change?**  
A: No, you will continue to use the same XDC wallet address.

**Q: How do I check my ROXN balance?**  
A: Your ROXN balance will be visible in the platform interface after migration. The UI will be updated to display ROXN tokens instead of XDC.

**Q: Can I still use XDC for operations after migration?**  
A: No, after migration, all operations will use ROXN tokens exclusively.

**Q: What is the value of ROXN compared to XDC?**  
A: Initially, ROXN tokens will be valued at parity with XDC for migration purposes. Market forces will determine the value after listing on exchanges.

**Q: What happens to my pending rewards?**  
A: All pending rewards will be migrated to ROXN tokens and will be claimable after migration is complete. 