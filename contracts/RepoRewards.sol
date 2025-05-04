// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICustomForwarder {
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) external view returns (bool);
}

contract RepoRewards is Initializable, ContextUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    
    struct PoolManager {
        string username;
        uint256 githubId;
        address wallet;
    }

    struct Contributor {
        string username;
        uint256 githubId;
        address wallet;
    }

    struct Issue {
        uint256 issueId;
        uint256 rewardAmount;
        string status;
    }

    struct Repository {
        address[] poolManagers;
        address[] contributors;
        uint256 poolRewards;
        uint256 issueCount;
        mapping(uint256 => Issue) issueRewards;
    }

    ICustomForwarder public forwarder;
    IERC20 public roxnToken;

    mapping(address => PoolManager) public poolManagers;
    mapping(address => Contributor) public contributors;
    mapping(uint256 => Repository) public repositories;

    address[] public poolManagerAddresses;
    address[] public contributorAddresses;
    address public admin;
    
    // Fee collection variables
    address public feeCollector;
    uint256 public platformFeeRate;
    uint256 public contributorFeeRate;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    mapping(address => bool) public upgraders;

    event UserRegistered(address indexed user, string username, string role);
    event RewardAllocated(string repoId, uint256 amount);
    event ForwarderInitialized(address forwarderAddress);
    event TokenInitialized(address tokenAddress);
    event UpgraderAdded(address upgrader);
    event UpgraderRemoved(address upgrader);
    event FeeParametersUpdated(address feeCollector, uint256 platformFeeRate, uint256 contributorFeeRate);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Revert Initializer signature to original (likely without feeCollector)
     * @param _forwarder The address of the custom forwarder contract
     * @param _roxnToken The address of the ROXN token contract
     */
    function initialize(address _forwarder, address _roxnToken) public initializer {
        require(_forwarder != address(0), "Invalid forwarder address");
        require(_roxnToken != address(0), "Invalid token address");
        
        __Context_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        forwarder = ICustomForwarder(_forwarder);
        roxnToken = IERC20(_roxnToken);
        
        admin = msg.sender;
        upgraders[msg.sender] = true;
        
        emit ForwarderInitialized(_forwarder);
        emit TokenInitialized(_roxnToken);
        emit UpgraderAdded(msg.sender);
    }

    function _msgSender() internal view override returns (address) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            assembly {
                calldatacopy(0, shl(3, sub(calldatasize(), 20)), 20)
                return(0, 20)
            }
        }
        return super._msgSender();
    }

    function isTrustedForwarder(address _forwarder) public view returns (bool) {
        return address(forwarder) == _forwarder;
    }

    modifier onlyPoolManager(uint256 repoId) {
        require(
            isPoolManager(repoId, _msgSender()) || _msgSender() == admin,
            "Not authorized"
        );
        _;
    }

    modifier onlyUpgrader() {
        require(upgraders[_msgSender()] || _msgSender() == owner(), "Not authorized to upgrade");
        _;
    }

    function isPoolManager(
        uint256 repoId,
        address manager
    ) internal view returns (bool) {
        Repository storage repo = repositories[repoId];
        for (uint i = 0; i < repo.poolManagers.length; i++) {
            if (repo.poolManagers[i] == manager) {
                return true;
            }
        }
        return false;
    }

    function registerUser(
        address userAddress,
        string memory username,
        string memory typeOfUser
    ) external {
        if (
            keccak256(abi.encodePacked(typeOfUser)) ==
            keccak256(abi.encodePacked("PoolManager"))
        ) {
            poolManagers[userAddress] = PoolManager(
                username,
                0, // githubId is not used anymore
                userAddress
            );
            poolManagerAddresses.push(userAddress);
        } else {
            contributors[userAddress] = Contributor(
                username,
                0, // githubId is not used anymore
                userAddress
            );
            contributorAddresses.push(userAddress);
        }
    }

    function addPoolManager(
        uint256 repoId,
        address poolManager,
        string memory username,
        uint256 githubId
    ) external onlyPoolManager(repoId) {
        Repository storage repo = repositories[repoId];
        repo.poolManagers.push(poolManager);
        poolManagers[poolManager] = PoolManager(
            username,
            githubId,
            poolManager
        );
        poolManagerAddresses.push(poolManager);
    }

    function allocateIssueReward(
        uint256 repoId,
        uint256 issueId,
        uint256 reward
    ) external onlyPoolManager(repoId) {
        Repository storage repo = repositories[repoId];
        
        // Prevent overwriting/updating an existing reward
        require(repo.issueRewards[issueId].rewardAmount == 0, "Bounty already assigned to this issue");
        require(reward > 0, "Bounty amount must be positive"); // Also ensure non-zero reward is being set
        require(repo.poolRewards >= reward, "Insufficient pool rewards");

        repo.issueRewards[issueId] = Issue({
            issueId: issueId,
            rewardAmount: reward, // This is XDC Wei
            status: "allocated"
        });

        repo.issueCount++;
        repo.poolRewards -= reward;
        // Emit an event? e.g., event BountyAssigned(uint256 indexed repoId, uint256 indexed issueId, uint256 amount);
    }

    function addFundToRepository(uint256 repoId) external payable {
        require(msg.value > 0, "XDC amount must be greater than 0");
        Repository storage repo = repositories[repoId];
        
        if (repo.poolManagers.length == 0) {
            repositories[repoId].poolManagers = new address[](0);
            repositories[repoId].contributors = new address[](0);
            repositories[repoId].poolManagers.push(_msgSender());
        }

        if (feeCollector != address(0)) {
            uint256 fee = (msg.value * platformFeeRate) / 10000;
            uint256 netAmount = msg.value - fee;

            (bool success, ) = feeCollector.call{value: fee}("");
            require(success, "Failed to send fee");

            repositories[repoId].poolRewards += netAmount;
        } else {
            repositories[repoId].poolRewards += msg.value;
        }
    }

    function distributeReward(
        uint256 repoId,
        uint256 issueId,
        address payable contributorAddress
    ) external onlyPoolManager(repoId) {
        Repository storage repo = repositories[repoId];
        Issue storage issue = repo.issueRewards[issueId];
        uint256 reward = issue.rewardAmount;
        
        require(reward > 0, "No reward allocated for this issue");
        require(bytes(issue.status).length > 0, "Issue does not exist");
        require(keccak256(bytes(issue.status)) == keccak256(bytes("allocated")), "Issue not in allocated state");
        require(contributorAddress != address(0), "Invalid contributor address");
        
        require(address(this).balance >= reward, "Insufficient contract XDC balance");

        delete repo.issueRewards[issueId];
        repo.issueCount--;

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

        uint256 commission = 0;
        uint256 netReward = reward;
        if (feeCollector != address(0) && contributorFeeRate > 0) {
            commission = (reward * contributorFeeRate) / 10000;
            netReward = reward - commission;
            require(netReward > 0, "Net reward must be positive");
        }

        if (commission > 0) {
            (bool successFee, ) = feeCollector.call{value: commission}("");
            require(successFee, "Failed to send commission");
        }

        (bool successReward, ) = contributorAddress.call{value: netReward}("");
        require(successReward, "Failed to send XDC net reward");
    }

    /**
     * @dev Updates the ROXN token address
     * @param _newTokenAddress The new token contract address
     */
    function updateTokenAddress(address _newTokenAddress) external onlyOwner {
        require(_newTokenAddress != address(0), "Invalid token address");
        roxnToken = IERC20(_newTokenAddress);
        emit TokenInitialized(_newTokenAddress);
    }
    
    /**
     * @dev Updates fee parameters for platform revenue collection
     * @param _feeCollector Address that will receive fees
     * @param _platformFeeRate Fee rate in basis points (e.g., 300 = 3%)
     * @param _contributorFeeRate Fee rate in basis points (e.g., 300 = 3%)
     */
    function updateFeeParameters(address _feeCollector, uint256 _platformFeeRate, uint256 _contributorFeeRate) external onlyOwner {
        require(_feeCollector != address(0), "Invalid fee collector address");
        require(_platformFeeRate <= 1000, "Platform fee rate cannot exceed 10%");
        require(_contributorFeeRate <= 1000, "Contributor fee rate cannot exceed 10%");
        
        feeCollector = _feeCollector;
        platformFeeRate = _platformFeeRate;
        contributorFeeRate = _contributorFeeRate;
        emit FeeParametersUpdated(_feeCollector, _platformFeeRate, _contributorFeeRate);
    }
    
    /**
     * @dev Updates the forwarder address
     * @param _newForwarder The new forwarder contract address
     */
    function updateForwarder(address _newForwarder) external onlyOwner {
        require(_newForwarder != address(0), "Invalid forwarder address");
        forwarder = ICustomForwarder(_newForwarder);
        emit ForwarderInitialized(_newForwarder);
    }
    
    /**
     * @dev Adds an address to the upgraders list
     * @param upgrader Address to be added as an upgrader
     */
    function addUpgrader(address upgrader) external onlyOwner {
        require(upgrader != address(0), "Invalid upgrader address");
        upgraders[upgrader] = true;
        emit UpgraderAdded(upgrader);
    }
    
    /**
     * @dev Removes an address from the upgraders list
     * @param upgrader Address to be removed as an upgrader
     */
    function removeUpgrader(address upgrader) external onlyOwner {
        require(upgraders[upgrader], "Not an upgrader");
        upgraders[upgrader] = false;
        emit UpgraderRemoved(upgrader);
    }

    /**
     * @dev Function that authorizes upgrades, only callable by upgraders
     * @param newImplementation The address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgrader {}

    receive() external payable {}

    function getPoolManager(
        address _wallet
    ) external view returns (PoolManager memory) {
        return poolManagers[_wallet];
    }

    function getContributor(
        address _wallet
    ) external view returns (Contributor memory) {
        return contributors[_wallet];
    }

    function getRepository(
        uint256 _repoId
    )
        external
        view
        returns (address[] memory, address[] memory, uint256, Issue[] memory)
    {
        Repository storage repo = repositories[_repoId];
        Issue[] memory issues = new Issue[](repo.issueCount);
        uint counter = 0;
        for (uint i = 0; i < repo.issueCount; i++) {
            if (repo.issueRewards[i].issueId != 0) {
                issues[counter] = repo.issueRewards[i];
                counter++;
            }
        }
        return (repo.poolManagers, repo.contributors, repo.poolRewards, issues);
    }

    function getIssueRewards(
        uint256 repoId,
        uint256[] memory issueIds
    ) external view returns (uint256[] memory) {
        Repository storage repo = repositories[repoId];
        uint256[] memory rewards = new uint256[](issueIds.length);
        for (uint i = 0; i < issueIds.length; i++) {
            rewards[i] = repo.issueRewards[issueIds[i]].rewardAmount;
        }
        return rewards;
    }

    function checkUserType(
        address _user
    ) external view returns (string memory, address) {
        if (poolManagers[_user].wallet != address(0)) {
            return ("PoolManager", _user);
        } else if (contributors[_user].wallet != address(0)) {
            return ("Contributor", _user);
        } else {
            return ("User does not exist", address(0));
        }
    }

    function getUserWalletByUsername(
        string memory username
    ) external view returns (address) {
        for (uint i = 0; i < poolManagerAddresses.length; i++) {
            if (
                keccak256(
                    abi.encodePacked(
                        poolManagers[poolManagerAddresses[i]].username
                    )
                ) == keccak256(abi.encodePacked(username))
            ) {
                return poolManagers[poolManagerAddresses[i]].wallet;
            }
        }
        for (uint i = 0; i < contributorAddresses.length; i++) {
            if (
                keccak256(
                    abi.encodePacked(
                        contributors[contributorAddresses[i]].username
                    )
                ) == keccak256(abi.encodePacked(username))
            ) {
                return contributors[contributorAddresses[i]].wallet;
            }
        }
        return address(0);
    }

    function getRepositoryRewards(
        uint256[] memory repoIds
    ) external view returns (uint256[] memory) {
        uint256[] memory rewards = new uint256[](repoIds.length);
        for (uint i = 0; i < repoIds.length; i++) {
            rewards[i] = repositories[repoIds[i]].poolRewards;
        }
        return rewards;
    }
    
    /**
     * @dev Reserve storage gap for future upgrades
     */
    uint256[50] private __gap;
}
