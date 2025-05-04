# ROXN Token Staking Implementation Specification
**Version**: 1.0.0  
**Date**: 2023-10-15  
**Status**: Draft  

## Table of Contents
- [1. Overview](#1-overview)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Design Goals](#12-design-goals)
- [2. Staking Architecture](#2-staking-architecture)
  - [2.1 Staking Pool Types](#21-staking-pool-types)
  - [2.2 Lock Period Options](#22-lock-period-options)
  - [2.3 Reward Mechanisms](#23-reward-mechanisms)
- [3. Smart Contract Implementation](#3-smart-contract-implementation)
  - [3.1 StakingManager.sol](#31-stakingmanagersol)
  - [3.2 RewardDistributor.sol](#32-rewarddistributorsol)
  - [3.3 StakingPool.sol](#33-stakingpoolsol)
- [4. Staking Rewards](#4-staking-rewards)
  - [4.1 Reward Sources](#41-reward-sources)
  - [4.2 Reward Calculation](#42-reward-calculation)
  - [4.3 Reward Distribution](#43-reward-distribution)
- [5. Governance Integration](#5-governance-integration)
  - [5.1 Voting Power](#51-voting-power)
  - [5.2 Multiplier System](#52-multiplier-system)
  - [5.3 Delegation Mechanics](#53-delegation-mechanics)
- [6. User Experience](#6-user-experience)
  - [6.1 Staking Flow](#61-staking-flow)
  - [6.2 Unstaking Process](#62-unstaking-process)
  - [6.3 UI Considerations](#63-ui-considerations)
- [7. Security Considerations](#7-security-considerations)
  - [7.1 Slashing Conditions](#71-slashing-conditions)
  - [7.2 Emergency Withdrawal](#72-emergency-withdrawal)
  - [7.3 Risk Mitigation](#73-risk-mitigation)
- [8. Deployment and Migration](#8-deployment-and-migration)
  - [8.1 Deployment Steps](#81-deployment-steps)
  - [8.2 Parameter Configuration](#82-parameter-configuration)
  - [8.3 Migration Strategy](#83-migration-strategy)

## 1. Overview

### 1.1 Purpose

The ROXN token staking system serves multiple critical functions within the Roxonn ecosystem:

1. **Governance Enhancement**: Providing stakers with increased voting power based on lock duration
2. **Token Utility**: Creating additional utility for ROXN through staking rewards
3. **Contributor Incentivization**: Providing ongoing rewards to active contributors and token holders
4. **Economic Stability**: Reducing token volatility by promoting long-term holding
5. **Security Alignment**: Ensuring stakeholders have "skin in the game" for governance decisions

This document outlines the technical implementation details, reward mechanisms, governance integration, and security considerations for the ROXN staking system.

### 1.2 Design Goals

The ROXN staking system is designed to achieve the following objectives:

- **Flexibility**: Multiple staking options with varying lock periods and rewards
- **Fairness**: Balanced reward distribution that doesn't overly favor large token holders
- **Security**: Robust protections against attacks and exploits
- **Simplicity**: Intuitive user experience for non-technical users
- **Efficiency**: Gas-optimized implementation for XDC network
- **Governance Alignment**: Seamless integration with the governance system
- **Contributor Focus**: Enhanced benefits for active platform contributors

## 2. Staking Architecture

### 2.1 Staking Pool Types

The staking system consists of multiple pool types to serve different use cases:

1. **Governance Staking**: Provides voting power in governance proposals
   - Tokens locked for fixed periods (1, 3, 6, or 12 months)
   - Voting power multipliers based on lock duration
   - Base APY rewards

2. **Liquidity Mining**: For liquidity providers on XSwap
   - Stake LP tokens (ROXN/XDC pairs)
   - Higher APY than governance staking
   - No voting power (to prevent double-counting)

3. **Contributor Staking**: Enhanced rewards for verified contributors
   - Same lock periods as governance staking
   - Additional contributor multiplier (1.1x - 1.5x)
   - Special benefits based on contribution level

### 2.2 Lock Period Options

The system offers multiple lock period options with corresponding rewards and voting power:

| Lock Period | Early Withdrawal | Base APY | Voting Multiplier |
|-------------|------------------|----------|-------------------|
| 1 month     | 20% penalty      | 5%       | 1.2x             |
| 3 months    | 25% penalty      | 8%       | 1.5x             |
| 6 months    | 30% penalty      | 12%      | 2.0x             |
| 12 months   | 40% penalty      | 18%      | 3.0x             |

Lock period features:
- Tokens are locked for the full duration and cannot be withdrawn without penalty
- Early withdrawal incurs a penalty on the staked amount
- Penalties are distributed to other stakers in the same pool
- Rewards continue to accrue until the end of the lock period or early withdrawal

### 2.3 Reward Mechanisms

The staking system implements several reward mechanisms:

1. **Base Rewards**: Fixed APY based on lock duration paid in ROXN tokens
2. **Bonus Rewards**: Additional rewards for specific actions or milestones
   - Governance participation bonus (for active voters)
   - Contribution milestone bonuses
   - Longevity bonuses for continued restaking
3. **LP Rewards**: Higher rewards for providing liquidity to ROXN/XDC pairs
4. **Referral Rewards**: Small bonuses for referring new stakers (5% of their rewards)

## 3. Smart Contract Implementation

### 3.1 StakingManager.sol

The main contract that coordinates all staking activities:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract StakingManager is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // State variables
    IERC20Upgradeable public roxnToken;
    address public rewardDistributor;
    mapping(uint256 => address) public stakingPools; // duration => pool address
    address public contributorRegistry;
    
    // Events
    event StakingPoolAdded(uint256 duration, address poolAddress);
    event RewardDistributorSet(address rewardDistributor);
    event ContributorRegistrySet(address contributorRegistry);
    
    // Initialization
    function initialize(
        address _roxnToken,
        address _admin
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        roxnToken = IERC20Upgradeable(_roxnToken);
    }
    
    // Pool management
    function addStakingPool(uint256 _duration, address _poolAddress) external onlyRole(ADMIN_ROLE) {
        require(stakingPools[_duration] == address(0), "Pool already exists for this duration");
        stakingPools[_duration] = _poolAddress;
        emit StakingPoolAdded(_duration, _poolAddress);
    }
    
    function setRewardDistributor(address _rewardDistributor) external onlyRole(ADMIN_ROLE) {
        rewardDistributor = _rewardDistributor;
        emit RewardDistributorSet(_rewardDistributor);
    }
    
    function setContributorRegistry(address _contributorRegistry) external onlyRole(ADMIN_ROLE) {
        contributorRegistry = _contributorRegistry;
        emit ContributorRegistrySet(_contributorRegistry);
    }
    
    // View functions
    function getStakingPool(uint256 _duration) external view returns (address) {
        return stakingPools[_duration];
    }
    
    function getStakingPoolCount() external view returns (uint256) {
        // Implementation to count pools
    }
    
    // Admin functions
    function recoverTokens(address _token, uint256 _amount) external onlyRole(ADMIN_ROLE) {
        IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);
    }
    
    // Upgradeability
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
```

### 3.2 RewardDistributor.sol

Contract responsible for calculating and distributing rewards:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract RewardDistributor is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant POOL_ROLE = keccak256("POOL_ROLE");
    
    // State variables
    IERC20Upgradeable public roxnToken;
    address public stakingManager;
    
    // Pool rewards configuration
    struct PoolReward {
        uint256 baseAPY; // Base APY in basis points (100 = 1%)
        uint256 lastUpdateTime;
        uint256 rewardRate; // Tokens per second
        uint256 rewardPerTokenStored;
        uint256 totalStaked;
    }
    
    mapping(address => PoolReward) public poolRewards; // pool address => reward config
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid; // pool => user => rewardPerTokenPaid
    mapping(address => mapping(address => uint256)) public rewards; // pool => user => reward amount
    
    // Events
    event RewardAdded(address indexed pool, uint256 reward);
    event RewardPaid(address indexed user, address indexed pool, uint256 reward);
    event PoolRewardRateUpdated(address indexed pool, uint256 newRate);
    
    // Initialization
    function initialize(
        address _roxnToken,
        address _stakingManager,
        address _admin
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        roxnToken = IERC20Upgradeable(_roxnToken);
        stakingManager = _stakingManager;
    }
    
    // Modifier to update rewards
    modifier updateReward(address _account, address _pool) {
        PoolReward storage poolReward = poolRewards[_pool];
        poolReward.rewardPerTokenStored = rewardPerToken(_pool);
        poolReward.lastUpdateTime = lastTimeRewardApplicable();
        
        if (_account != address(0)) {
            rewards[_pool][_account] = earned(_account, _pool);
            userRewardPerTokenPaid[_pool][_account] = poolReward.rewardPerTokenStored;
        }
        _;
    }
    
    // Core reward functions
    function rewardPerToken(address _pool) public view returns (uint256) {
        PoolReward storage poolReward = poolRewards[_pool];
        
        if (poolReward.totalStaked == 0) {
            return poolReward.rewardPerTokenStored;
        }
        
        return poolReward.rewardPerTokenStored + (
            ((lastTimeRewardApplicable() - poolReward.lastUpdateTime) * 
             poolReward.rewardRate * 1e18) / 
            poolReward.totalStaked
        );
    }
    
    function earned(address _account, address _pool) public view returns (uint256) {
        PoolReward storage poolReward = poolRewards[_pool];
        
        uint256 userStaked = IStakingPool(_pool).balanceOf(_account);
        
        return (userStaked * 
            (rewardPerToken(_pool) - userRewardPerTokenPaid[_pool][_account])) / 
            1e18 + 
            rewards[_pool][_account];
    }
    
    function getReward(address _pool) external nonReentrant updateReward(msg.sender, _pool) {
        uint256 reward = rewards[_pool][msg.sender];
        if (reward > 0) {
            rewards[_pool][msg.sender] = 0;
            roxnToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, _pool, reward);
        }
    }
    
    // Admin functions
    function addRewardToPool(address _pool, uint256 _amount) external onlyRole(ADMIN_ROLE) {
        roxnToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit RewardAdded(_pool, _amount);
    }
    
    function setPoolRewardRate(address _pool, uint256 _baseAPY) external onlyRole(ADMIN_ROLE) {
        PoolReward storage poolReward = poolRewards[_pool];
        poolReward.baseAPY = _baseAPY;
        
        // Calculate rewards per second based on APY
        uint256 secondsPerYear = 365 days;
        poolReward.rewardRate = (poolReward.totalStaked * _baseAPY) / (secondsPerYear * 10000);
        
        emit PoolRewardRateUpdated(_pool, poolReward.rewardRate);
    }
    
    // Functions called by staking pools
    function notifyStaked(address _user, uint256 _amount) external onlyRole(POOL_ROLE) updateReward(_user, msg.sender) {
        PoolReward storage poolReward = poolRewards[msg.sender];
        poolReward.totalStaked += _amount;
    }
    
    function notifyUnstaked(address _user, uint256 _amount) external onlyRole(POOL_ROLE) updateReward(_user, msg.sender) {
        PoolReward storage poolReward = poolRewards[msg.sender];
        poolReward.totalStaked -= _amount;
    }
    
    // Upgradeability
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    // View functions
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp;
    }
    
    function getPoolAPY(address _pool) external view returns (uint256) {
        return poolRewards[_pool].baseAPY;
    }
}

interface IStakingPool {
    function balanceOf(address account) external view returns (uint256);
}
```

### 3.3 StakingPool.sol

Individual staking pool implementation for each lock duration:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract StakingPool is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // State variables
    IERC20Upgradeable public roxnToken;
    address public stakingManager;
    address public rewardDistributor;
    address public contributorRegistry;
    
    // Pool configuration
    uint256 public lockDuration;
    uint256 public earlyWithdrawalPenalty; // In basis points (100 = 1%)
    
    // Stake tracking
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }
    
    mapping(address => StakeInfo) public userStakes;
    uint256 public totalStaked;
    
    // Voting power tracking
    uint256 public votingPowerMultiplier; // In basis points (100 = 1%)
    
    // Events
    event Staked(address indexed user, uint256 amount, uint256 lockEndTime);
    event Unstaked(address indexed user, uint256 amount, bool isPenalized);
    event PenaltyCollected(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    
    // Initialization
    function initialize(
        address _roxnToken,
        address _stakingManager,
        address _rewardDistributor,
        address _contributorRegistry,
        uint256 _lockDuration,
        uint256 _earlyWithdrawalPenalty,
        uint256 _votingPowerMultiplier,
        address _admin
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        roxnToken = IERC20Upgradeable(_roxnToken);
        stakingManager = _stakingManager;
        rewardDistributor = _rewardDistributor;
        contributorRegistry = _contributorRegistry;
        
        lockDuration = _lockDuration;
        earlyWithdrawalPenalty = _earlyWithdrawalPenalty;
        votingPowerMultiplier = _votingPowerMultiplier;
    }
    
    // Core staking functions
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot stake 0");
        require(userStakes[msg.sender].active == false, "Already has active stake");
        
        // Transfer tokens from user
        roxnToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // Update stake info
        userStakes[msg.sender] = StakeInfo({
            amount: _amount,
            startTime: block.timestamp,
            endTime: block.timestamp + lockDuration,
            active: true
        });
        
        // Update total staked
        totalStaked += _amount;
        
        // Notify reward distributor
        IRewardDistributor(rewardDistributor).notifyStaked(msg.sender, _amount);
        
        emit Staked(msg.sender, _amount, block.timestamp + lockDuration);
    }
    
    function unstake() external nonReentrant {
        StakeInfo storage stakeInfo = userStakes[msg.sender];
        require(stakeInfo.active, "No active stake");
        
        uint256 amount = stakeInfo.amount;
        bool isPenalized = block.timestamp < stakeInfo.endTime;
        
        // Calculate penalty if unstaking early
        uint256 penaltyAmount = 0;
        if (isPenalized) {
            penaltyAmount = (amount * earlyWithdrawalPenalty) / 10000;
        }
        
        // Update user stake info
        stakeInfo.active = false;
        
        // Update total staked
        totalStaked -= amount;
        
        // Notify reward distributor
        IRewardDistributor(rewardDistributor).notifyUnstaked(msg.sender, amount);
        
        // Transfer tokens back to user minus penalty
        uint256 transferAmount = amount - penaltyAmount;
        roxnToken.safeTransfer(msg.sender, transferAmount);
        
        // Distribute penalty to other stakers via reward contract
        if (penaltyAmount > 0) {
            roxnToken.safeTransfer(rewardDistributor, penaltyAmount);
            emit PenaltyCollected(msg.sender, penaltyAmount);
        }
        
        emit Unstaked(msg.sender, amount, isPenalized);
    }
    
    function claimReward() external nonReentrant {
        IRewardDistributor(rewardDistributor).getReward(address(this));
    }
    
    // View functions
    function getStakeInfo(address _user) external view returns (uint256 amount, uint256 startTime, uint256 endTime, bool active) {
        StakeInfo storage stakeInfo = userStakes[_user];
        return (stakeInfo.amount, stakeInfo.startTime, stakeInfo.endTime, stakeInfo.active);
    }
    
    function getTimeUntilUnlock(address _user) external view returns (uint256) {
        StakeInfo storage stakeInfo = userStakes[_user];
        if (!stakeInfo.active || block.timestamp >= stakeInfo.endTime) {
            return 0;
        }
        return stakeInfo.endTime - block.timestamp;
    }
    
    function balanceOf(address _user) external view returns (uint256) {
        StakeInfo storage stakeInfo = userStakes[_user];
        return stakeInfo.active ? stakeInfo.amount : 0;
    }
    
    function getVotingPower(address _user) external view returns (uint256) {
        StakeInfo storage stakeInfo = userStakes[_user];
        if (!stakeInfo.active) {
            return 0;
        }
        
        uint256 baseVotingPower = stakeInfo.amount;
        uint256 multiplier = votingPowerMultiplier;
        
        // Check if user is a contributor and apply additional multiplier
        if (contributorRegistry != address(0)) {
            uint256 contributorLevel = IContributorRegistry(contributorRegistry).getContributorLevel(_user);
            if (contributorLevel > 0) {
                // Apply contributor multiplier based on level (implementation-specific)
                // This would typically be 10-50% extra voting power
            }
        }
        
        return (baseVotingPower * multiplier) / 10000;
    }
    
    // Admin functions
    function setVotingPowerMultiplier(uint256 _multiplier) external onlyRole(ADMIN_ROLE) {
        votingPowerMultiplier = _multiplier;
    }
    
    function setRewardDistributor(address _rewardDistributor) external onlyRole(ADMIN_ROLE) {
        rewardDistributor = _rewardDistributor;
    }
    
    function setContributorRegistry(address _contributorRegistry) external onlyRole(ADMIN_ROLE) {
        contributorRegistry = _contributorRegistry;
    }
    
    // Emergency functions
    function emergencyWithdraw(address _user) external onlyRole(ADMIN_ROLE) {
        StakeInfo storage stakeInfo = userStakes[_user];
        require(stakeInfo.active, "No active stake");
        
        uint256 amount = stakeInfo.amount;
        
        // Update user stake info
        stakeInfo.active = false;
        
        // Update total staked
        totalStaked -= amount;
        
        // Transfer tokens back to user (no penalty in emergency)
        roxnToken.safeTransfer(_user, amount);
        
        emit Unstaked(_user, amount, false);
    }
    
    // Upgradeability
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}

interface IRewardDistributor {
    function notifyStaked(address user, uint256 amount) external;
    function notifyUnstaked(address user, uint256 amount) external;
    function getReward(address pool) external;
}

interface IContributorRegistry {
    function getContributorLevel(address user) external view returns (uint256);
}
```

## 4. Staking Rewards

### 4.1 Reward Sources

The staking rewards come from multiple sources:

1. **Initial Allocation**: 20% of the total ROXN supply (200M tokens) allocated to staking rewards
2. **Treasury Funding**: Regular transfers from the treasury to sustain rewards (governance-decided)
3. **Early Withdrawal Penalties**: Penalties from early unstaking redistributed to stakers
4. **Protocol Fees**: A portion of platform fees directed to staking rewards
5. **Ecosystem Revenue**: Future revenue streams from the Roxonn platform

The reward allocation from the initial 200M tokens follows this distribution schedule:
- Year 1: 50M tokens (25% of allocation)
- Year 2: 50M tokens (25% of allocation)
- Year 3: 40M tokens (20% of allocation)
- Year 4: 30M tokens (15% of allocation)
- Year 5: 30M tokens (15% of allocation)

### 4.2 Reward Calculation

Rewards are calculated using a time-weighted token distribution formula:

```
rewards[user] = userStakedAmount * (rewardPerToken - userRewardPerTokenPaid)
```

Where:
- `rewardPerToken` increases over time based on the reward rate
- `userRewardPerTokenPaid` is updated whenever a user stakes, unstakes, or claims rewards

The reward rate for each pool is determined by:

```
rewardRate = (totalStaked * baseAPY) / (secondsPerYear * 10000)
```

This ensures that rewards are distributed proportionally to the amount staked and time staked.

### 4.3 Reward Distribution

Rewards are distributed through the following mechanisms:

1. **Continuous Accrual**: Rewards accrue continuously based on time and amount staked
2. **Claim Process**: Users can claim their rewards at any time without unstaking
3. **Compound Options**: Users can choose to restake claimed rewards
4. **Bonuses**: Additional rewards for specific conditions:
   - Governance participation: +5% rewards for active voters
   - Contribution level: +10-50% based on platform contributions
   - Longevity: +2% per month for continued staking (capped at +24%)

## 5. Governance Integration

### 5.1 Voting Power

The staking system directly integrates with governance through voting power:

1. **Base Voting Power**: 1 ROXN token = 1 vote
2. **Staking Multiplier**: Increased voting power based on lock duration
3. **Contributor Multiplier**: Additional voting power for active contributors
4. **Delegation**: Ability to delegate voting power to other addresses

Staked tokens automatically count toward governance voting power, with no additional action required from users.

### 5.2 Multiplier System

The voting power multiplier system works as follows:

1. **Lock Duration Multipliers**:
   - 1-month stake: 1.2x multiplier
   - 3-month stake: 1.5x multiplier
   - 6-month stake: 2.0x multiplier
   - 12-month stake: 3.0x multiplier

2. **Contributor Multipliers**:
   - Bronze contributor: 1.1x multiplier
   - Silver contributor: 1.2x multiplier
   - Gold contributor: 1.5x multiplier

3. **Combined Multiplier**:
   ```
   Voting Power = Token Amount × Duration Multiplier × Contributor Multiplier
   ```

4. **Effect on Governance**:
   - Higher voting power = greater influence in governance decisions
   - Encourages long-term token locking and platform contributions
   - Multipliers are capped to prevent excessive centralization

### 5.3 Delegation Mechanics

The staking system includes delegation mechanisms:

1. **Full Delegation**: Delegate entire voting power to another address
2. **Partial Delegation**: Split voting power among multiple delegates
3. **Automatic Delegation**: Option to delegate to specific addresses for specific proposal types
4. **Delegation Rewards**: Incentives for active delegates who participate in governance

Delegation allows users who don't want to actively participate in governance to still have their tokens' voting power contribute to platform decisions.

## 6. User Experience

### 6.1 Staking Flow

The staking user flow is designed to be simple and intuitive:

1. **Choose Stake Type**: Select from governance, liquidity, or contributor staking
2. **Select Lock Period**: Choose from 1, 3, 6, or 12 months
3. **Enter Amount**: Specify the amount of ROXN to stake
4. **Review Terms**: View lock period, rewards, voting power, and early withdrawal penalties
5. **Confirm Transaction**: Approve and execute the staking transaction
6. **Receive Confirmation**: Get confirmation of successful staking

The frontend will show estimated rewards, voting power, and unlock date to help users make informed decisions.

### 6.2 Unstaking Process

The unstaking process follows these steps:

1. **View Stake Details**: See current stake amount, lock end date, and potential penalties
2. **Initiate Unstake**: Request to unstake tokens
3. **Review Penalty** (if applicable): See the early withdrawal penalty amount
4. **Confirm Transaction**: Approve and execute the unstaking transaction
5. **Receive Tokens**: Tokens (minus any penalty) are returned to the user's wallet

Early withdrawal penalties are clearly communicated to users before they confirm the unstaking transaction.

### 6.3 UI Considerations

The staking interface should include:

1. **Dashboard**: Overview of all staking positions and rewards
2. **Analytics**: Historical reward data and APY trends
3. **Reward Forecasting**: Projected rewards based on current rates
4. **Governance Integration**: Clear indication of current voting power
5. **Notifications**: Alerts for unlocking dates, governance votes, and reward claims
6. **Mobile Optimization**: Responsive design for all devices

## 7. Security Considerations

### 7.1 Slashing Conditions

The staking system implements the following slashing conditions:

1. **Early Withdrawal Penalty**: Penalties for unstaking before the lock period ends
2. **Governance Violation Penalty**: Potential future implementation to penalize malicious governance actions
3. **Penalty Distribution**: All penalties are redistributed to remaining stakers

Slashing is limited to voluntary actions (early withdrawal) and does not include conditions that could result in unexpected token loss.

### 7.2 Emergency Withdrawal

An emergency withdrawal mechanism exists for critical situations:

1. **Guardian-Activated**: Only callable by the Guardian role (multi-sig controlled)
2. **No Penalties**: Emergency withdrawals incur no penalties
3. **Limited Use**: Only available during contract upgrades or critical security incidents
4. **Transparency Requirements**: Must be announced and explained to the community

This provides a safety valve while preventing abuse through strong governance controls.

### 7.3 Risk Mitigation

Several risk mitigation strategies are implemented:

1. **Contract Audits**: Comprehensive third-party audits before deployment
2. **Formal Verification**: Mathematical verification of reward algorithms
3. **Rate Limiting**: Maximum staking and unstaking amounts per time period
4. **Gradual Parameter Changes**: Changes to reward rates and other parameters are time-locked
5. **Separation of Concerns**: StakingManager, RewardDistributor, and StakingPool contracts have distinct responsibilities

## 8. Deployment and Migration

### 8.1 Deployment Steps

The deployment process follows these steps:

1. **Deploy Contracts**:
   - Deploy ROXNToken if not already deployed
   - Deploy StakingManager
   - Deploy RewardDistributor
   - Deploy StakingPool contracts for each lock duration

2. **Configure Contracts**:
   - Set contract references (token, manager, distributor)
   - Grant appropriate roles
   - Set initial parameters (APYs, multipliers, durations)

3. **Fund Reward Contract**:
   - Transfer initial reward allocation to RewardDistributor

4. **Enable Staking**:
   - Activate staking pools

### 8.2 Parameter Configuration

Initial parameters will be set as follows:

1. **Lock Durations**: 30 days, 90 days, 180 days, 365 days
2. **Base APYs**: 5%, 8%, 12%, 18%
3. **Voting Multipliers**: 1.2x, 1.5x, 2.0x, 3.0x
4. **Early Withdrawal Penalties**: 20%, 25%, 30%, 40%
5. **Contributor Multipliers**: 1.1x (Bronze), 1.2x (Silver), 1.5x (Gold)

These parameters can be adjusted through governance once the system is live.

### 8.3 Migration Strategy

For future upgrades, the following migration strategy will be used:

1. **Announce Changes**: Communicate upcoming changes to the community
2. **Deploy New Contracts**: Deploy upgraded contracts alongside existing ones
3. **Migration Period**: Allow users to migrate stakes without penalties
4. **Incentivize Migration**: Offer bonus rewards for early migration
5. **Complete Migration**: Once sufficient stakes are migrated, deprecate old contracts

The UUPS upgrade pattern allows for seamless upgrades without requiring users to migrate manually in most cases.

---

*This staking specification provides a comprehensive framework for implementing the ROXN token staking system. It is designed to integrate seamlessly with the governance system and provide flexible, secure staking options for all users.* 