// Deployment script for RepoRewards with UUPS proxy pattern
const { ethers } = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Deploying RepoRewards contracts with upgradeable pattern...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  // Get current gas price and account balance
  const feeData = await ethers.provider.getFeeData();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Current gas price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
  console.log(`Account balance: ${ethers.formatEther(balance)} XDC`);

  // Get required addresses from environment
  const forwarderAddress = process.env.FORWARDER_CONTRACT_ADDRESS;
  const roxnTokenAddress = process.env.ROXN_TOKEN_ADDRESS;

  if (!forwarderAddress || !ethers.isAddress(forwarderAddress)) {
    throw new Error("FORWARDER_CONTRACT_ADDRESS not set or invalid in environment");
  }

  if (!roxnTokenAddress || !ethers.isAddress(roxnTokenAddress)) {
    throw new Error("ROXN_TOKEN_ADDRESS not set or invalid in environment");
  }

  console.log(`Using forwarder at: ${forwarderAddress}`);
  console.log(`Using ROXN token at: ${roxnTokenAddress}`);

  try {
    // Deploy the implementation contract first with higher gas limit
    console.log("Deploying implementation contract...");
    const RepoRewards = await ethers.getContractFactory("RepoRewards");
    const repoRewardsImpl = await RepoRewards.deploy({
      gasLimit: 8000000
    });
    await repoRewardsImpl.waitForDeployment();
    const repoRewardsImplAddress = await repoRewardsImpl.getAddress();
    console.log(`RepoRewards implementation deployed to: ${repoRewardsImplAddress}`);

    // Prepare initialization data (encoded initialize function call)
    console.log("Preparing initialization data...");
    const initData = RepoRewards.interface.encodeFunctionData('initialize', [forwarderAddress, roxnTokenAddress]);

    // Deploy the proxy contract with the implementation address and initialization data
    console.log("Deploying proxy contract...");
    const RepoRewardsProxy = await ethers.getContractFactory("RepoRewardsProxy");
    const repoRewardsProxy = await RepoRewardsProxy.deploy(repoRewardsImplAddress, initData, {
      gasLimit: 8000000
    });
    
    console.log("Waiting for proxy deployment transaction to be mined...");
    await repoRewardsProxy.waitForDeployment();
    const repoRewardsProxyAddress = await repoRewardsProxy.getAddress();
    console.log(`RepoRewardsProxy deployed to: ${repoRewardsProxyAddress}`);

    // Get a reference to the proxied contract for verification
    const proxiedRepoRewards = RepoRewards.attach(repoRewardsProxyAddress);
    console.log("RepoRewards deployment complete!");

    // Verify the deployment was successful
    console.log("Verifying deployment...");
    const adminAddress = await proxiedRepoRewards.owner();
    const storedForwarderAddress = await proxiedRepoRewards.forwarder();
    const storedTokenAddress = await proxiedRepoRewards.roxnToken();

    console.log(`Owner: ${adminAddress}`);
    console.log(`Forwarder address: ${storedForwarderAddress}`);
    console.log(`ROXN token address: ${storedTokenAddress}`);

    const isUpgraderCheck = await proxiedRepoRewards.upgraders(deployer.address);
    console.log(`Deployer is an upgrader: ${isUpgraderCheck}`);

    console.log("");
    console.log("Contract Addresses (SAVE THESE):");
    console.log(`RepoRewards Implementation: ${repoRewardsImplAddress}`);
    console.log(`RepoRewards Proxy: ${repoRewardsProxyAddress}`);
    console.log("");
    console.log("Next steps:");
    console.log("1. Update .env file with REPO_REWARDS_CONTRACT_ADDRESS=${repoRewardsProxyAddress}");
    console.log("2. Update .env file with REPO_REWARDS_IMPL_ADDRESS=${repoRewardsImplAddress}");
    console.log("3. Verify the contracts on the block explorer (optional)");
  } catch (error) {
    console.error("Error during deployment:");
    console.error(error);
    
    if (error.receipt) {
      console.log("Transaction receipt:");
      console.log(`  Status: ${error.receipt.status}`);
      console.log(`  Gas used: ${error.receipt.gasUsed.toString()}`);
      console.log(`  Block number: ${error.receipt.blockNumber}`);
      console.log(`  Contract address (if created): ${error.receipt.contractAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 