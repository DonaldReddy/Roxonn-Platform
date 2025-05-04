// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title RepoRewardsProxy
 * @dev UUPS Proxy contract for the RepoRewards
 * This contract delegates all calls to an implementation contract.
 */
contract RepoRewardsProxy is ERC1967Proxy {
    /**
     * @dev Constructor that initializes the proxy with an implementation and initialization data
     * @param _implementation The address of the implementation contract
     * @param _data The encoded call data for initializing the implementation (typically RepoRewards.initialize())
     */
    constructor(
        address _implementation,
        bytes memory _data
    ) ERC1967Proxy(_implementation, _data) {}
} 