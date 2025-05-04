# ROXN Token UUPS Implementation Guide

## Overview

This document explains the implementation of the Universal Upgradeable Proxy Standard (UUPS) for the ROXN token. The UUPS pattern allows for contract logic to be upgraded without changing the contract address or requiring token migrations.

## Contract Architecture

The ROXN token implementation consists of two main contracts:

1. **ROXNToken.sol**: The implementation contract that contains all the token logic.
2. **ROXNTokenProxy.sol**: The proxy contract that delegates all calls to the implementation contract.

![UUPS Architecture](https://i.imgur.com/ZVZcjvh.png)

## How UUPS Works

The UUPS pattern works as follows:

1. Users interact with the **Proxy Contract**, which has a permanent address.
2. The proxy delegates all function calls to the current **Implementation Contract**.
3. The implementation contract can be upgraded by calling an upgrade function that is part of the implementation itself.
4. When an upgrade occurs, the proxy is updated to point to a new implementation contract.
5. All state (balances, allowances, etc.) remains in the proxy's storage, making the upgrade seamless for users.

## Key Features

### Access Control

The upgrade process is protected by role-based access control:

- Only addresses with the `UPGRADER_ROLE` can initiate an upgrade.
- The `DEFAULT_ADMIN_ROLE` can grant or revoke roles.
- Other roles include `MINTER_ROLE`, `PAUSER_ROLE`, and `BURNER_ROLE`.

### Storage Layout

The implementation uses a careful storage layout to ensure compatibility during upgrades:

- The contract inherits from OpenZeppelin's Upgradeable contracts.
- A storage gap (`__gap`) is included to allow for future storage variables without causing conflicts.

### Initialization vs Constructor

Instead of a constructor, the contract uses an initializer function:

- The `initialize()` function can only be called once.
- It sets up the initial state, including granting roles to the admin.
- A constructor is still present but only to disable initializers for the implementation contract.

## Deployment Process

The deployment process follows these steps:

1. Deploy the implementation contract (`ROXNToken.sol`).
2. Prepare the initialization data for the proxy.
3. Deploy the proxy contract (`ROXNTokenProxy.sol`) with the implementation address and initialization data.
4. Interact with the token through the proxy address.

## Upgrade Process

To upgrade the ROXN token:

1. Deploy a new implementation contract.
2. Call the `upgradeTo(address)` function on the proxy, passing the new implementation address.
3. The upgrade is complete, and all future calls will use the new implementation logic.

## Security Considerations

- **Authorization**: Only addresses with `UPGRADER_ROLE` can perform upgrades.
- **Implementation Protection**: The implementation contract's initializers are disabled to prevent direct initialization.
- **Storage Compatibility**: Care must be taken to ensure storage layouts are compatible between versions.

## Scripts

The following scripts are provided:

- `deploy_roxn_token.js`: Deploys both the implementation and proxy contracts.
- `upgrade_roxn_token.js`: Demonstrates how to upgrade to a new implementation.
- `mint_roxn_tokens.js`: Shows how to interact with the token through the proxy.

## Best Practices

When working with UUPS contracts:

1. Always interact with the proxy address, never with the implementation directly.
2. When developing a new implementation, ensure storage compatibility with the previous version.
3. Conduct thorough testing before deploying upgrades to production.
4. Consider using a timelock or multi-signature scheme for the `UPGRADER_ROLE`.
5. Document all changes between implementations. 