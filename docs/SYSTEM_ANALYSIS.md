# Roxonn System Analysis

## Core System Components and Files

### 1. Authentication Flow
**Key Files:**
- `server/auth.ts` - Main authentication logic
- `server/github.ts` - GitHub OAuth integration
- `server/config.ts` - Authentication configuration
- `server/aws.ts` - AWS services integration for secure storage

**Flow:**
1. User initiates GitHub OAuth
2. System authenticates with GitHub
3. Creates/retrieves user profile
4. Generates/manages authentication tokens
5. Secures credentials with AWS KMS

### 2. Token System
**Key Files:**
- `contracts/ROXNToken.sol` - ERC20/XRC20 token implementation
- `docs/TOKEN_SPECIFICATION.md` - Token design specification
- `docs/ROXN_CONTRACT_IMPLEMENTATION.md` - Detailed implementation guide
- `server/blockchain.ts` - Token interaction logic

**Features:**
1. Role-based access control (RBAC)
2. Pausable and burnable functionality
3. Maximum supply cap (1 billion tokens)
4. Integration with RepoRewards system
5. Future upgradeability via UUPS pattern

### 3. Wallet Management Flow
**Key Files:**
- `server/tatum.ts` - Tatum API integration for wallet operations
- `server/blockchain.ts` - Blockchain interaction logic
- `contracts/CustomForwarder.sol` - Gas-efficient transaction forwarding
- `server/storage.ts` - Secure wallet storage
- `server/walletService.ts` - Wallet operations handler

**Flow:**
1. User registration triggers wallet creation
2. Tatum API generates secure wallet
3. System stores encrypted wallet details
4. Relayer setup for gas-efficient operations
5. AWS KMS for key security

### 4. Repository Reward Management Flow
**Key Files:**
- `contracts/RepoRewards.sol` - Main smart contract
- `server/blockchain.ts` - Contract interaction logic
- `server/routes.ts` - API endpoints for reward management
- `client/src/components/repo-rewards.tsx` - UI for reward management

**Smart Contract Functions:**
```solidity
- addFundToRepository() - Pool funding
- allocateIssueReward() - Reward allocation
- distributeReward() - Reward distribution
- addPoolManager() - Manager authorization
```

**Flow:**
1. Pool Manager adds funds to repository
2. Allocates rewards to specific issues
3. Contributors claim rewards
4. System processes reward distribution

### 5. Database Schema and Storage
**Key Files:**
- `server/db.ts` - Database configuration
- `drizzle.config.ts` - ORM configuration
- `migrations/` - Database migrations

**Stored Data:**
- User profiles
- Wallet information
- Repository metadata
- Transaction history
- Reward allocations

### 6. API Routes and Endpoints
**Key Files:**
- `server/routes.ts` - API route definitions
- `server/index.ts` - Server setup and middleware
- `server/vite.ts` - Development server configuration

**Main Endpoints:**
1. Authentication endpoints
2. Wallet management endpoints
3. Repository management endpoints
4. Reward distribution endpoints
5. Transaction management endpoints

### 7. Security Implementation
**Key Files:**
- `server/aws.ts` - AWS security integration
- `contracts/CustomForwarder.sol` - Secure transaction forwarding
- `server/auth.ts` - Authentication security

**Security Features:**
1. Encrypted wallet storage with AWS KMS
2. Secure key management
3. Protected API endpoints
4. Transaction validation
5. Rate limiting and monitoring

## Extended System Capabilities

### 1. Staking System
**Key Files:**
- `docs/STAKING_IMPLEMENTATION.md` - Staking system specification
- Future implementation in smart contracts

**Features:**
1. Multi-tiered staking mechanisms
2. Time-based multipliers
3. Governance voting power
4. Reward distribution
5. Lock periods and early withdrawal penalties

### 2. Governance System
**Key Files:**
- `docs/GOVERNANCE_SPECIFICATION.md` - Governance system specification
- Future implementation in smart contracts

**Features:**
1. On-chain proposal system
2. Voting mechanisms
3. Execution of approved proposals
4. Delegation capabilities
5. Treasury management

### 3. Anti-Gaming Protection
**Key Files:**
- `docs/ANTI_GAMING_SYSTEM.md` - Anti-gaming system specification
- Future implementation in smart contracts and backend

**Features:**
1. Contribution validation mechanisms
2. Reputation-based verification
3. Time-locked rewards
4. Activity monitoring
5. Dispute resolution processes

## Transaction Flows

### 1. User Registration
**Files Involved:**
- `server/auth.ts`
- `server/github.ts`
- `server/tatum.ts`
- `server/blockchain.ts`
- `contracts/RepoRewards.sol`

**Steps:**
1. GitHub OAuth authentication
2. User profile creation
3. Wallet generation
4. Blockchain registration
5. Database record creation

### 2. Repository Setup
**Files Involved:**
- `server/blockchain.ts`
- `contracts/RepoRewards.sol`
- `server/routes.ts`
- `server/github.ts`

**Steps:**
1. Repository verification
2. Pool Manager assignment
3. Initial fund allocation
4. Smart contract initialization

### 3. Reward Distribution
**Files Involved:**
- `contracts/RepoRewards.sol`
- `server/blockchain.ts`
- `server/routes.ts`
- `server/github.ts`

**Steps:**
1. Issue completion verification
2. Reward allocation confirmation
3. Smart contract transaction
4. Distribution confirmation
5. ROXN token transfer to contributor

## System Requirements

### Environment Variables
```
# Server and Database
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# Authentication
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-api.com/api/auth/callback/github
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Blockchain
XDC_RPC_URL=https://rpc.apothem.network
PRIVATE_KEY=your_relayer_private_key
REPO_REWARDS_CONTRACT_ADDRESS=your_rewards_contract_address
ROXN_TOKEN_ADDRESS=your_token_contract_address
FORWARDER_CONTRACT_ADDRESS=your_forwarder_contract_address

# Security
ENCRYPTION_KEY=your_encryption_key
AWS_REGION=your_aws_region
WALLET_KMS_KEY_ID=your_kms_key_id
```

### Dependencies
- Node.js and npm
- PostgreSQL database
- XDC Network access
- GitHub OAuth credentials
- AWS account with KMS configured
- Tatum API access

## Client-Side Architecture

### 1. Frontend Structure (`client/` directory)
**Key Files and Directories:**
- `client/src/components/` - Reusable UI components
- `client/src/hooks/` - Custom React hooks
- `client/src/lib/` - Utility functions and libraries
- `client/src/pages/` - Page components and routing
- `client/src/App.tsx` - Main application component
- `client/src/main.tsx` - Application entry point

**Frontend Features:**
1. Web3 Integration for blockchain interaction
2. GitHub OAuth Flow for authentication
3. Repository Management Interface
4. Reward Distribution Dashboard
5. Wallet Management UI
6. Responsive design with Tailwind CSS

### 2. Key Components
**Core Components:**
- `repo-rewards.tsx` - Repository rewards management and distribution
- `pool-managers.tsx` - Pool manager dashboard and management interface
- `wallet-info.tsx` - Wallet information and management
- `navigation-bar.tsx` - Main navigation component
- `ui/` directory - Reusable UI components library

**Component Responsibilities:**

1. Repository Rewards Component:
   - Repository reward status
   - Issue reward allocation
   - Distribution interface
   - Transaction history

2. Pool Managers Component:
   - Manager registration
   - Repository fund management
   - Reward allocation interface
   - Manager permissions control

3. Wallet Info Component:
   - Wallet balance display
   - Transaction history
   - Address information
   - Token interaction

## Deployment Architecture

### Production Setup
1. **API Server**:
   - Express backend with PM2 process management
   - Nginx as reverse proxy
   - SSL/TLS encryption
   - Rate limiting and security headers

2. **Frontend Application**:
   - Static files served via Nginx
   - CDN integration for assets
   - Client-side caching strategy

3. **Database**:
   - PostgreSQL with regular backups
   - Connection pooling
   - Performance monitoring

4. **Monitoring and Logging**:
   - Centralized logging system
   - Performance metrics collection
   - Alerting for system issues
   - Transaction monitoring 