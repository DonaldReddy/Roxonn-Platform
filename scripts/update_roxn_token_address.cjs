// Script to update the ROXN token address in the RepoRewards contract
const { ethers } = require("hardhat");
const hre = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Updating ROXN token address in RepoRewards contract...");

  // Get the account that will execute the update (must be the owner of RepoRewards contract)
  const [updater] = await ethers.getSigners();
  console.log(`Updating with account: ${updater.address}`);

  // Get the contract addresses from .env
  const repoRewardsAddress = process.env.REPO_REWARDS_CONTRACT_ADDRESS;
  const newTokenAddress = process.env.ROXN_TOKEN_ADDRESS; // Our new UUPS ROXN token proxy address
  
  console.log(`RepoRewards contract address: ${repoRewardsAddress}`);
  console.log(`New ROXN token address: ${newTokenAddress}`);

  // Verify the addresses are valid
  if (!ethers.isAddress(repoRewardsAddress) || !ethers.isAddress(newTokenAddress)) {
    console.error("Error: Invalid contract addresses in .env file");
    return;
  }

  // Get the RepoRewards contract instance
  const RepoRewards = await ethers.getContractFactory("RepoRewards");
  const repoRewards = await RepoRewards.attach(repoRewardsAddress);

  // Get the current token address for comparison
  const currentTokenAddress = await repoRewards.roxnToken();
  console.log(`Current token address: ${currentTokenAddress}`);

  // Check if the updater is the owner of the contract
  const owner = await repoRewards.owner();
  
  if (owner.toLowerCase() !== updater.address.toLowerCase()) {
    console.error(`Error: Updater (${updater.address}) is not the owner of the RepoRewards contract (${owner})`);
    return;
  }
  
  console.log("Updater is the owner of the RepoRewards contract ✓");

  // Check if the token address actually needs to be updated
  if (currentTokenAddress.toLowerCase() === newTokenAddress.toLowerCase()) {
    console.log("Token address is already set to the correct value. No update needed.");
    return;
  }

  console.log("Updating token address...");
  
  // Update the token address with explicit gas limit
  const tx = await repoRewards.updateTokenAddress(newTokenAddress, {
    gasLimit: 3000000
  });
  
  // Wait for the transaction to be mined
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  
  // Verify the update was successful
  const updatedTokenAddress = await repoRewards.roxnToken();
  console.log(`Updated token address: ${updatedTokenAddress}`);
  
  if (updatedTokenAddress.toLowerCase() === newTokenAddress.toLowerCase()) {
    console.log("Token address updated successfully! ✅");
  } else {
    console.error("Error: Token address update failed ❌");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 