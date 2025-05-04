// Script to verify RepoRewards contracts on the XDC explorer
require('dotenv').config({ path: './server/.env' });
const hre = require("hardhat");

async function main() {
    console.log("Starting RepoRewards contract verification...");
    
    // Get contract addresses from environment
    const repoRewardsImpl = process.env.REPO_REWARDS_IMPL_ADDRESS;
    const repoRewardsProxy = process.env.REPO_REWARDS_CONTRACT_ADDRESS;
    const forwarderAddress = process.env.FORWARDER_CONTRACT_ADDRESS;
    const roxnTokenAddress = process.env.ROXN_TOKEN_ADDRESS;
    
    // Verify implementation contract exists
    console.log(`\nVerifying RepoRewards implementation at: ${repoRewardsImpl}`);
    
    try {
        // Verify the implementation contract
        console.log("Attempting to verify implementation contract...");
        await hre.run("verify:verify", {
            address: repoRewardsImpl,
            contract: "contracts/RepoRewards.sol:RepoRewards"
        });
        console.log("Implementation contract verification successful!");
    } catch (error) {
        console.error("Error verifying implementation contract:", error.message);
    }
    
    try {
        // For the proxy, we need to prepare the initialization data
        console.log(`\nVerifying RepoRewards proxy at: ${repoRewardsProxy}`);
        console.log("Preparing initialization data...");
        
        // Get contract factory to encode initialization data
        const RepoRewards = await hre.ethers.getContractFactory("RepoRewards");
        const initData = RepoRewards.interface.encodeFunctionData('initialize', [forwarderAddress, roxnTokenAddress]);
        
        // Verify the proxy contract
        console.log("Attempting to verify proxy contract...");
        await hre.run("verify:verify", {
            address: repoRewardsProxy,
            contract: "contracts/RepoRewardsProxy.sol:RepoRewardsProxy",
            constructorArguments: [
                repoRewardsImpl,
                initData
            ]
        });
        console.log("Proxy contract verification successful!");
    } catch (error) {
        console.error("Error verifying proxy contract:", error.message);
    }
    
    console.log("\nVerification process completed!");
    
    // Provide manual verification commands for reference
    console.log("\nManual verification commands (if needed):");
    console.log(`npx hardhat verify --network xdcTestnet --contract contracts/RepoRewards.sol:RepoRewards ${repoRewardsImpl}`);
    
    const RepoRewards = await hre.ethers.getContractFactory("RepoRewards");
    const initData = RepoRewards.interface.encodeFunctionData('initialize', [forwarderAddress, roxnTokenAddress]);
    console.log(`npx hardhat verify --network xdcTestnet --contract contracts/RepoRewardsProxy.sol:RepoRewardsProxy ${repoRewardsProxy} ${repoRewardsImpl} ${initData}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 