// Script to upgrade RepoRewards to a new implementation
const { ethers, upgrades } = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Upgrading RepoRewards implementation...");

  // Get the upgrader account
  const [upgrader] = await ethers.getSigners();
  console.log(`Upgrading with account: ${upgrader.address}`);

  // Address of the proxy contract from environment
  const proxyAddress = process.env.REPO_REWARDS_CONTRACT_ADDRESS;
  const currentImplementationAddress = process.env.REPO_REWARDS_IMPL_ADDRESS; // Get current implementation address
  
  if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
    throw new Error("REPO_REWARDS_CONTRACT_ADDRESS not set or invalid in environment");
  }
  
  // Add check for current implementation address if needed for import
  // if (!currentImplementationAddress || !ethers.isAddress(currentImplementationAddress)) { 
  //   throw new Error("REPO_REWARDS_IMPL_ADDRESS not set or invalid in environment for import"); 
  // } 
  
  console.log(`Using RepoRewards proxy at: ${proxyAddress}`);
  // console.log(`Attempting to import existing implementation at: ${currentImplementationAddress}`);

  // Get Contract Factory
  const RepoRewards = await ethers.getContractFactory("RepoRewards");
  
  // Import the existing deployment first - Run ONCE if needed, then comment out.
  /* // Re-comment this block after successful import
  try {
      console.log("Importing existing proxy...");
      await upgrades.forceImport(proxyAddress, RepoRewards, { kind: 'uups' });
      console.log("Proxy imported successfully or already tracked.");
  } catch (importError) { 
      console.warn(`Could not import proxy (maybe already tracked?): ${importError.message}`);
  }
  */ // Re-comment this block

  // Attach to proxy (still useful for permission checks)
  const proxiedRepoRewards = await RepoRewards.attach(proxyAddress);

  // Verify the upgrader has the necessary rights
  const isUpgrader = await proxiedRepoRewards.upgraders(upgrader.address);
  const isOwner = (await proxiedRepoRewards.owner()).toLowerCase() === upgrader.address.toLowerCase();
  
  if (!isUpgrader && !isOwner) {
    console.error("Error: Upgrader does not have permission to upgrade the contract");
    console.error("The account must either be an upgrader or the contract owner");
    return;
  }
  
  console.log(`Upgrade permission verified: ${isUpgrader ? "Is upgrader" : "Is owner"}`);

  // Deploy new implementation using Hardhat Upgrades plugin
  console.log("Preparing upgrade (deploys new implementation if needed)...");
  const newImplementationAddress = await upgrades.prepareUpgrade(proxyAddress, RepoRewards);
  console.log(`New implementation prepared/deployed at: ${newImplementationAddress}`);

  // Upgrade the proxy using Hardhat Upgrades plugin
  console.log(`Upgrading proxy (${proxyAddress}) using upgrades plugin...`);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, RepoRewards);
  await upgraded.waitForDeployment(); // Wait for the upgrade transaction
  console.log(`RepoRewards proxy upgraded successfully.`);

  // Remove manual upgradeTo call
  /*
  console.log(`Attempting to upgrade proxy (${proxyAddress}) to implementation (${newImplementationAddress})...`);
  const tx = await proxiedRepoRewards.upgradeTo(newImplementationAddress, {
    gasLimit: 3000000
  });
  await tx.wait();
  console.log(`RepoRewards successfully upgraded to: ${newImplementationAddress}`);
  */
  
  // Verification steps (attach again to be sure? or use 'upgraded' instance)
  console.log("Verifying upgrade...");
  const finalInstance = RepoRewards.attach(proxyAddress); // Attach again to check state
  try {
    const owner = await finalInstance.owner();
    const forwarderAddress = await finalInstance.forwarder();
    const tokenAddress = await finalInstance.roxnToken();
    const platformFee = await finalInstance.platformFeeRate();
    const contributorFee = await finalInstance.contributorFeeRate(); // Check new variable
    
    console.log("Upgrade verification:");
    console.log(`- Proxy Address: ${proxyAddress}`);
    console.log(`- Current Implementation (from plugin perspective): ${await upgrades.erc1967.getImplementationAddress(proxyAddress)}`);
    console.log(`- Owner: ${owner}`);
    console.log(`- Forwarder: ${forwarderAddress}`);
    console.log(`- Token: ${tokenAddress}`);
    console.log(`- Platform Fee Rate: ${platformFee.toString()}`);
    console.log(`- Contributor Fee Rate: ${contributorFee.toString()}`); // Verify fee
    console.log("Upgrade complete and verified! ✅");
  } catch (error) {
    console.error("Error verifying the upgrade:", error.message);
    console.error("The upgrade might have failed or the new implementation is incompatible.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 