# ROXN Token Smart Contract Implementation Specification
**Version**: 1.0.0  
**Date**: 2023-10-15  
**Status**: Draft  

## Table of Contents
- [1. Overview](#1-overview)
- [2. Contract Implementation](#2-contract-implementation)
   - [2.1 ROXNToken.sol](#21-roxntokensol)
   - [2.2 ROXNTokenProxy.sol](#22-roxntokenproxysol)
   - [2.3 VestingManager.sol](#23-vestingmanagersol)
   - [2.4 RewardDistributor.sol](#24-rewarddistributorsol)
- [3. Integration with RepoRewards](#3-integration-with-reporewards)
   - [3.1 RepoRewards.sol Modifications](#31-reporewardssol-modifications)
   - [3.2 CustomForwarder.sol Considerations](#32-customforwardersol-considerations)
- [4. Deployment Scripts](#4-deployment-scripts)
   - [4.1 Token Deployment](#41-token-deployment)
   - [4.2 Roles Configuration](#42-roles-configuration)
   - [4.3 Initial Minting](#43-initial-minting)
- [5. Security Measures](#5-security-measures)
- [6. Testing Framework](#6-testing-framework)

## 1. Overview

This document provides detailed specifications for implementing the ROXN token smart contracts. It includes contract structures, function definitions, event specifications, deployment scripts, and integration guidelines with the existing Roxonn platform.

## 2. Contract Implementation

### 2.1 ROXNToken.sol

#### Dependencies
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
```

#### Contract Structure
```solidity
contract ROXNToken is 
    Initializable, 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable, 
    ERC20PausableUpgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    // Roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    // Minting constraints
    uint256 public remainingContributorRewards;
    uint256 public monthlyEmissionCap;
    uint256 public lastEmissionTimestamp;
    
    // Initialization
    function initialize(
        string memory name,
        string memory symbol,
        address admin
    ) initializer public {
        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        
        // Set initial contributor rewards allocation (400M tokens)
        remainingContributorRewards = 400_000_000 * 10**decimals();
        
        // Set monthly emission cap (5.33M tokens)
        monthlyEmissionCap = 5_333_333 * 10**decimals();
        lastEmissionTimestamp = block.timestamp;
    }
    
    // Core token functionality
    
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    function mintContributorRewards(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(amount <= remainingContributorRewards, "Exceeds remaining contributor rewards");
        
        // Check monthly emission cap
        uint256 timeElapsed = block.timestamp - lastEmissionTimestamp;
        uint256 monthsElapsed = timeElapsed / 30 days;
        uint256 availableEmission = monthlyEmissionCap * (monthsElapsed + 1);
        
        require(amount <= availableEmission, "Exceeds monthly emission cap");
        
        remainingContributorRewards -= amount;
        lastEmissionTimestamp = block.timestamp;
        _mint(to, amount);
    }
    
    function burnFrom(address account, uint256 amount) public override onlyRole(BURNER_ROLE) {
        _burn(account, amount);
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // Required overrides
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    // The following functions are overrides required by Solidity
    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }
}
```

### 2.2 ROXNTokenProxy.sol

This is a standard proxy contract using OpenZeppelin's UUPSUpgradeable pattern. No custom implementation is needed beyond deploying the proxy with the correct implementation address.

### 2.3 VestingManager.sol

#### Dependencies
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
```

#### Contract Structure
```solidity
contract VestingManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public roxnToken;
    
    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTimestamp;
        uint256 cliffDuration;
        uint256 duration;
        bool revocable;
        bool revoked;
    }
    
    // Vesting schedule id => VestingSchedule
    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    
    // Beneficiary address => array of vesting schedule ids
    mapping(address => bytes32[]) public beneficiarySchedules;
    
    // Total amount of tokens locked in vesting schedules
    uint256 public totalVestingTokens;
    
    event VestingScheduleCreated(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount);
    event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount);
    event VestingScheduleRevoked(bytes32 indexed scheduleId, address indexed beneficiary);
    
    constructor(address _tokenAddress) Ownable(msg.sender) {
        roxnToken = IERC20(_tokenAddress);
    }
    
    function createVestingSchedule(
        address _beneficiary,
        uint256 _startTimestamp,
        uint256 _cliffDuration,
        uint256 _duration,
        uint256 _amount,
        bool _revocable
    ) external onlyOwner {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_duration > 0, "Duration must be > 0");
        require(_amount > 0, "Amount must be > 0");
        require(_duration >= _cliffDuration, "Duration must be >= cliff");
        
        // Create vesting schedule
        bytes32 scheduleId = keccak256(abi.encodePacked(_beneficiary, block.timestamp, _amount));
        
        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: _beneficiary,
            totalAmount: _amount,
            releasedAmount: 0,
            startTimestamp: _startTimestamp,
            cliffDuration: _cliffDuration,
            duration: _duration,
            revocable: _revocable,
            revoked: false
        });
        
        // Update beneficiary schedules
        beneficiarySchedules[_beneficiary].push(scheduleId);
        
        // Update total vesting tokens
        totalVestingTokens += _amount;
        
        // Transfer tokens to vesting contract
        roxnToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        emit VestingScheduleCreated(scheduleId, _beneficiary, _amount);
    }
    
    function releaseVestedTokens(bytes32 _scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        require(schedule.beneficiary == msg.sender, "Not schedule beneficiary");
        require(!schedule.revoked, "Schedule was revoked");
        
        uint256 vestedAmount = calculateVestedAmount(schedule);
        uint256 releasableAmount = vestedAmount - schedule.releasedAmount;
        
        require(releasableAmount > 0, "No tokens to release");
        
        // Update state
        schedule.releasedAmount += releasableAmount;
        totalVestingTokens -= releasableAmount;
        
        // Transfer tokens
        roxnToken.safeTransfer(schedule.beneficiary, releasableAmount);
        
        emit TokensReleased(_scheduleId, schedule.beneficiary, releasableAmount);
    }
    
    function revokeVestingSchedule(bytes32 _scheduleId) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        require(schedule.revocable, "Schedule not revocable");
        require(!schedule.revoked, "Schedule already revoked");
        
        // Calculate vested amount up to now
        uint256 vestedAmount = calculateVestedAmount(schedule);
        uint256 releasableAmount = vestedAmount - schedule.releasedAmount;
        
        // Calculate remaining unvested tokens
        uint256 remainingTokens = schedule.totalAmount - vestedAmount;
        
        // Update state
        schedule.revoked = true;
        totalVestingTokens -= remainingTokens;
        
        // Transfer vested but unreleased tokens to beneficiary
        if (releasableAmount > 0) {
            schedule.releasedAmount += releasableAmount;
            roxnToken.safeTransfer(schedule.beneficiary, releasableAmount);
            emit TokensReleased(_scheduleId, schedule.beneficiary, releasableAmount);
        }
        
        // Transfer remaining tokens back to owner
        if (remainingTokens > 0) {
            roxnToken.safeTransfer(owner(), remainingTokens);
        }
        
        emit VestingScheduleRevoked(_scheduleId, schedule.beneficiary);
    }
    
    function calculateVestedAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTimestamp) {
            return 0;
        }
        
        // Cliff period not yet passed
        if (block.timestamp < schedule.startTimestamp + schedule.cliffDuration) {
            return 0;
        }
        
        // Fully vested
        if (block.timestamp >= schedule.startTimestamp + schedule.duration) {
            return schedule.totalAmount;
        }
        
        // Partially vested (linear vesting)
        uint256 timeElapsed = block.timestamp - schedule.startTimestamp;
        return (schedule.totalAmount * timeElapsed) / schedule.duration;
    }
    
    function getVestingSchedule(bytes32 _scheduleId) external view returns (
        address beneficiary,
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 startTimestamp,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable,
        bool revoked
    ) {
        VestingSchedule memory schedule = vestingSchedules[_scheduleId];
        return (
            schedule.beneficiary,
            schedule.totalAmount,
            schedule.releasedAmount,
            schedule.startTimestamp,
            schedule.cliffDuration,
            schedule.duration,
            schedule.revocable,
            schedule.revoked
        );
    }
    
    function getBeneficiarySchedules(address _beneficiary) external view returns (bytes32[] memory) {
        return beneficiarySchedules[_beneficiary];
    }
    
    function getVestedAmount(bytes32 _scheduleId) external view returns (uint256) {
        return calculateVestedAmount(vestingSchedules[_scheduleId]);
    }
    
    function getReleasableAmount(bytes32 _scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[_scheduleId];
        uint256 vestedAmount = calculateVestedAmount(schedule);
        return vestedAmount - schedule.releasedAmount;
    }
}
```

### 2.4 RewardDistributor.sol

#### Dependencies
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
```

#### Contract Structure
```solidity
contract RewardDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public roxnToken;
    
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    // Reward allocation and tracking
    uint256 public totalDistributed;
    uint256 public weeklyAllocationCap;
    uint256 public lastResetTimestamp;
    uint256 public weeklyDistributed;
    
    // Events
    event RewardDistributed(address indexed contributor, uint256 amount, string reason);
    event WeeklyCapUpdated(uint256 newCap);
    
    constructor(address _tokenAddress) {
        roxnToken = IERC20(_tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        
        // Set initial weekly cap to 1M ROXN
        weeklyAllocationCap = 1_000_000 * 10**18;
        lastResetTimestamp = block.timestamp;
    }
    
    function distributeReward(
        address _contributor,
        uint256 _amount,
        string memory _reason
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(_contributor != address(0), "Invalid contributor address");
        require(_amount > 0, "Reward amount must be > 0");
        
        // Check if we need to reset weekly tracking
        if (block.timestamp >= lastResetTimestamp + 7 days) {
            weeklyDistributed = 0;
            lastResetTimestamp = block.timestamp;
        }
        
        // Check weekly cap
        require(weeklyDistributed + _amount <= weeklyAllocationCap, "Exceeds weekly allocation cap");
        
        // Update state
        totalDistributed += _amount;
        weeklyDistributed += _amount;
        
        // Transfer tokens
        roxnToken.safeTransferFrom(msg.sender, _contributor, _amount);
        
        emit RewardDistributed(_contributor, _amount, _reason);
    }
    
    function setWeeklyAllocationCap(uint256 _newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        weeklyAllocationCap = _newCap;
        emit WeeklyCapUpdated(_newCap);
    }
    
    function getRemainingWeeklyAllocation() external view returns (uint256) {
        // If a week has passed, return the full cap
        if (block.timestamp >= lastResetTimestamp + 7 days) {
            return weeklyAllocationCap;
        }
        
        // Otherwise return the remaining allocation
        return weeklyAllocationCap - weeklyDistributed;
    }
    
    function isWeeklyCapReset() external view returns (bool) {
        return block.timestamp >= lastResetTimestamp + 7 days;
    }
}
```

## 3. Integration with RepoRewards

### 3.1 RepoRewards.sol Modifications

The existing RepoRewards.sol contract needs modifications to work with ROXN tokens instead of native XDC. Key changes include:

#### New State Variables
```solidity
IERC20 public roxnToken;
bool public usingNativeToken; // Flag to indicate if using native XDC or ROXN token
```

#### Constructor Modification
```solidity
constructor(address _forwarder, address _roxnToken) Ownable(msg.sender) {
    require(_forwarder != address(0), "Invalid forwarder address");
    require(_roxnToken != address(0), "Invalid token address");
    
    forwarder = ICustomForwarder(_forwarder);
    roxnToken = IERC20(_roxnToken);
    emit ForwarderInitialized(_forwarder);
    
    admin = msg.sender;
    usingNativeToken = false; // Default to using ROXN token
}
```

#### Modified addFundToRepository
```solidity
function addFundToRepository(uint256 repoId, uint256 amount) external {
    Repository storage repo = repositories[repoId];
    if (repo.poolManagers.length == 0) {
        // Create a new repository if it doesn't exist
        repositories[repoId].poolManagers = new address[](0);
        repositories[repoId].contributors = new address[](0);
        // Add the sender as the pool manager
        repositories[repoId].poolManagers.push(_msgSender());
        poolManagerAddresses.push(_msgSender());
    }
    
    if (usingNativeToken) {
        require(msg.value == amount, "Value doesn't match amount");
        repositories[repoId].poolRewards += msg.value;
    } else {
        require(msg.value == 0, "Value must be 0 when using tokens");
        roxnToken.safeTransferFrom(_msgSender(), address(this), amount);
        repositories[repoId].poolRewards += amount;
    }
}
```

#### Modified distributeReward
```solidity
function distributeReward(
    uint256 repoId,
    uint256 issueId,
    address payable contributorAddress
) external onlyPoolManager(repoId) {
    Repository storage repo = repositories[repoId];
    Issue storage issue = repo.issueRewards[issueId];
    uint256 reward = issue.rewardAmount;
    
    require(reward > 0, "No reward allocated for this issue");
    delete repo.issueRewards[issueId];
    repo.issueCount--;
    
    if (usingNativeToken) {
        require(address(this).balance >= reward, "Insufficient contract balance");
        (bool success, ) = contributorAddress.call{ value: reward }("");
        require(success, "Reward transfer failed");
    } else {
        require(roxnToken.balanceOf(address(this)) >= reward, "Insufficient token balance");
        roxnToken.safeTransfer(contributorAddress, reward);
    }

    // Add contributor to repository if not already added
    bool isExistingContributor = false;
    for (uint i = 0; i < repo.contributors.length; i++) {
        if (repo.contributors[i] == contributorAddress) {
            isExistingContributor = true;
            break;
        }
    }
    
    if (!isExistingContributor) {
        repo.contributors.push(contributorAddress);
    }
}
```

#### Migration Function
```solidity
function setTokenMode(bool _useNativeToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
    usingNativeToken = _useNativeToken;
}
```

### 3.2 CustomForwarder.sol Considerations

The CustomForwarder.sol contract may need to be extended to handle token approvals for meta-transactions:

```solidity
// Add a function to execute ERC20 approve operations
function executeERC20Approve(
    ForwardRequest calldata req,
    bytes calldata signature,
    address token,
    address spender,
    uint256 amount
) public returns (bool) {
    require(verify(req, signature), "CustomForwarder: signature does not match request");
    _nonces[req.from] = req.nonce + 1;
    
    // Execute approve on behalf of the user
    IERC20(token).approve(spender, amount);
    
    return true;
}
```

## 4. Deployment Scripts

### 4.1 Token Deployment

```typescript
// deploy-token.ts
import { ethers, upgrades } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);
  
  // Deploy upgradeable ROXNToken
  const ROXNToken = await ethers.getContractFactory('ROXNToken');
  const proxy = await upgrades.deployProxy(ROXNToken, [
    'Roxonn Token',
    'ROXN',
    deployer.address
  ], { kind: 'uups' });
  
  await proxy.deployed();
  console.log('ROXNToken deployed to:', proxy.address);
  
  // Deploy VestingManager
  const VestingManager = await ethers.getContractFactory('VestingManager');
  const vestingManager = await VestingManager.deploy(proxy.address);
  await vestingManager.deployed();
  console.log('VestingManager deployed to:', vestingManager.address);
  
  // Deploy RewardDistributor
  const RewardDistributor = await ethers.getContractFactory('RewardDistributor');
  const rewardDistributor = await RewardDistributor.deploy(proxy.address);
  await rewardDistributor.deployed();
  console.log('RewardDistributor deployed to:', rewardDistributor.address);
  
  // Return the deployed contract addresses
  return {
    tokenProxy: proxy.address,
    vestingManager: vestingManager.address,
    rewardDistributor: rewardDistributor.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 4.2 Roles Configuration

```typescript
// configure-roles.ts
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Load deployed contracts
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const multiSigAddress = process.env.MULTISIG_ADDRESS;
  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_ADDRESS;
  
  const roxnToken = await ethers.getContractAt('ROXNToken', tokenAddress);
  
  // Grant roles to multi-sig
  const ADMIN_ROLE = await roxnToken.DEFAULT_ADMIN_ROLE();
  const PAUSER_ROLE = await roxnToken.PAUSER_ROLE();
  const MINTER_ROLE = await roxnToken.MINTER_ROLE();
  const UPGRADER_ROLE = await roxnToken.UPGRADER_ROLE();
  
  // Transfer all roles to multi-sig wallet
  await roxnToken.grantRole(ADMIN_ROLE, multiSigAddress);
  await roxnToken.grantRole(PAUSER_ROLE, multiSigAddress);
  await roxnToken.grantRole(MINTER_ROLE, multiSigAddress);
  await roxnToken.grantRole(UPGRADER_ROLE, multiSigAddress);
  
  // Grant minter role to reward distributor
  await roxnToken.grantRole(MINTER_ROLE, rewardDistributorAddress);
  
  // Renounce own roles (deployer)
  await roxnToken.renounceRole(ADMIN_ROLE, deployer.address);
  await roxnToken.renounceRole(PAUSER_ROLE, deployer.address);
  await roxnToken.renounceRole(MINTER_ROLE, deployer.address);
  await roxnToken.renounceRole(UPGRADER_ROLE, deployer.address);
  
  console.log('Roles configured successfully');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 4.3 Initial Minting

```typescript
// initial-mint.ts
import { ethers } from 'hardhat';

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const vestingManagerAddress = process.env.VESTING_MANAGER_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const liquidityFundAddress = process.env.LIQUIDITY_FUND_ADDRESS;
  
  const roxnToken = await ethers.getContractAt('ROXNToken', tokenAddress);
  
  // Initial minting (excluding contributor rewards which are handled separately)
  
  // Team & Advisors (15%) - sent to vesting manager
  const teamAllocation = ethers.utils.parseUnits('150000000', 18);
  await roxnToken.mint(vestingManagerAddress, teamAllocation);
  
  // Liquidity & Staking (20%)
  const liquidityAllocation = ethers.utils.parseUnits('200000000', 18);
  await roxnToken.mint(liquidityFundAddress, liquidityAllocation);
  
  // Marketing & Growth (10%)
  const marketingAllocation = ethers.utils.parseUnits('100000000', 18);
  await roxnToken.mint(treasuryAddress, marketingAllocation);
  
  // Early Investors (10%) - sent to vesting manager
  const investorAllocation = ethers.utils.parseUnits('100000000', 18);
  await roxnToken.mint(vestingManagerAddress, investorAllocation);
  
  // Reserve Fund (5%)
  const reserveAllocation = ethers.utils.parseUnits('50000000', 18);
  await roxnToken.mint(treasuryAddress, reserveAllocation);
  
  // Initial contributor rewards (20% of the 40% total allocation)
  const initialContributorRewards = ethers.utils.parseUnits('80000000', 18);
  await roxnToken.mintContributorRewards(treasuryAddress, initialContributorRewards);
  
  console.log('Initial minting completed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 5. Security Measures

1. **Reentrancy Protection**: All contracts with external calls implement the ReentrancyGuard to prevent reentrancy attacks.

2. **Access Control**: Strict role-based access control for all privileged operations.

3. **Safe Token Transfers**: Using SafeERC20 for all token transfers to handle non-standard token implementations.

4. **Pausability**: Token transfers can be paused in emergency situations.

5. **Input Validation**: All functions include proper input validation and require statements.

6. **Storage Layout Management**: Careful attention to storage layout in upgradeable contracts to prevent storage collisions.

7. **Event Emission**: Events emitted for all state changes to facilitate off-chain tracking.

8. **Gas Optimization**: Efficient code patterns to minimize gas usage.

## 6. Testing Framework

Each contract should have comprehensive test coverage including:

1. **Unit Tests**: Test individual functions and features
   - Basic functionality (transfer, approve, etc.)
   - Access control checks
   - Edge cases and error conditions

2. **Integration Tests**: Test interaction between contracts
   - Token with Vesting Manager
   - Token with Reward Distributor
   - RepoRewards integration

3. **Security Tests**: Test security aspects
   - Role protection
   - Pausability
   - Upgrade mechanism

4. **Stress Tests**: Test under high load
   - Multiple vesting schedules
   - Batch reward distributions

5. **Gas Optimization Tests**: Measure gas usage for key operations 