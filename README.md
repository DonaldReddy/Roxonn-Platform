# Roxonn with XDC Blockchain Integration

A decentralized platform for managing GitHub repository contributions using XDC blockchain technology. This system enables secure identity management, reward distribution, and contribution tracking for open-source projects using the ROXN token.

## Architecture Overview

```mermaid
graph TB
    subgraph Frontend
        React[React Application]
        Web3[Web3 Integration]
        UI[UI Components]
    end

    subgraph Backend
        Express[Express Server]
        BlockchainService[Blockchain Service]
        AuthService[Auth Service]
        WalletService[Wallet Service]
        StorageService[Storage Service]
    end

    subgraph Blockchain
        ROXNToken[ROXN Token Contract]
        RepoRewards[RepoRewards Contract]
        CustomForwarder[Custom Forwarder]
    end

    subgraph External
        GitHub[GitHub OAuth]
        XDCNetwork[XDC Network]
        TatumAPI[Tatum API]
    end

    React --> Express
    Express --> BlockchainService
    Express --> AuthService
    Express --> WalletService
    Express --> StorageService
    BlockchainService --> ROXNToken
    BlockchainService --> RepoRewards
    BlockchainService --> CustomForwarder
    WalletService --> TatumAPI
    AuthService --> GitHub
    ROXNToken --> XDCNetwork
    RepoRewards --> XDCNetwork
    CustomForwarder --> XDCNetwork
```

## Implementation Details

### 1. Smart Contract Architecture
- **ROXNToken Contract**: ERC20/XRC20 token with role-based access control
  - Features pausable, burnable functionality
  - Implements maximum supply cap of 1 billion tokens
- **RepoRewards Contract**: Manages repository rewards and contribution tracking
  - Pool Managers: Can allocate rewards and manage repositories
  - Contributors: Can receive rewards for contributions
  - Uses a gas-efficient design with optimized storage
- **CustomForwarder Contract**: Meta-transaction implementation
  - Enables gas-less transactions for better user experience
  - Implements EIP-712 signature verification

### 2. User Registration Flow
1. User authenticates via GitHub OAuth
2. System generates XDC wallet using Tatum API
3. Relayer wallet registers user on blockchain
4. User wallet details stored securely in database

### 3. Transaction Management
- **Relayer Wallet**: 
  - Handles user registration transactions
  - Manages gas fees for onboarding
  - Uses dynamic gas pricing with network monitoring
- **User Wallet**:
  - Manages personal transactions (allocating funds, etc.)
  - Requires user signature for operations
  - Full control over funds and rewards

### 4. Security Features
- Secure wallet generation and storage
- Protected API endpoints
- Relayer wallet with limited permissions
- Transaction signing validation
- Gas price management for network stability
- AWS KMS integration for key management

## Extended Functionality

The platform includes detailed specifications for:

1. **Token System**: Comprehensive ROXN token implementation ([details](docs/TOKEN_SPECIFICATION.md))
2. **Staking Mechanisms**: Multi-tiered staking with governance benefits ([details](docs/STAKING_IMPLEMENTATION.md))
3. **Governance Framework**: On-chain governance with proposal system ([details](docs/GOVERNANCE_SPECIFICATION.md))
4. **Anti-Gaming Protection**: Mechanisms to prevent reward system abuse ([details](docs/ANTI_GAMING_SYSTEM.md))
5. **Contract Upgradeability**: UUPS proxy pattern implementation ([details](docs/ROXN_CONTRACT_IMPLEMENTATION.md))
6. **Migration Strategy**: Token and system migration guidelines ([details](docs/MIGRATION_GUIDE.md))

## Technology Stack
- Frontend: React, TypeScript, Web3.js, Tailwind CSS
- Backend: Express, TypeScript, PostgreSQL, Drizzle ORM
- Blockchain: XDC Network (Apothem Testnet)
- Smart Contracts: Solidity, OpenZeppelin
- Wallet Management: Tatum API, AWS KMS
- Deployment: Docker, Nginx

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run the development server: `npm run dev`

### Development Environment
```
# Backend
npm run dev:server

# Frontend
npm run dev:client

# Smart Contracts
npx hardhat compile
npx hardhat test
```

## Contributing
Contributions are welcome! Please read our contributing guidelines for details.

## License

This project operates under a dual-license model:

1.  **Core Functionality (AGPLv3):** The core components of the Roxonn Platform are licensed under the GNU Affero General Public License v3.0. See the [LICENSE](LICENSE) file for details. This ensures the core remains free and open-source, promoting community contribution and transparency.

2.  **Enterprise Edition (Commercial):** Certain advanced features, integrations, or specific deployment scenarios may be offered under a separate commercial license. See [LICENSE_EE.md](LICENSE_EE.md) for the terms of the Enterprise Edition license.

Please review the relevant license file based on your intended use case. Contributions to the core AGPLv3 codebase are subject to the terms outlined in [CONTRIBUTING.md](CONTRIBUTING.md).
