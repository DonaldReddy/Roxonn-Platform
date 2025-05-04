const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("Setting fee parameters...");

  // Get the owner account (ensure PRIVATE_KEY in .env is the owner)
  const [owner] = await ethers.getSigners();
  console.log(`Using owner account: ${owner.address}`);

  // Get contract addresses and fee values from environment
  const proxyAddress = "0xdbB179e9F715FCAd710d6dE538748d0226Bbc4E3"; // Our newly deployed RepoRewards proxy
  const feeCollectorAddress = process.env.ADMIN_ADDRESS; // Using admin address as fee collector
  // Read rates from env, fallback to desired defaults if needed, parse as integers
  const platformFee = 50; // 0.5% platform fee 
  const contributorFee = 50; // 0.5% contributor fee

  console.log(`Target Proxy: ${proxyAddress}`);
  console.log(`Setting Fee Collector: ${feeCollectorAddress}`);
  console.log(`Setting Platform Fee Rate: ${platformFee} ( ${(platformFee / 100).toFixed(2)}% )`);
  console.log(`Setting Contributor Fee Rate: ${contributorFee} ( ${(contributorFee / 100).toFixed(2)}% )`);

  // Get contract factory and attach to proxy
  const RepoRewards = await ethers.getContractFactory("RepoRewards");
  const contractInstance = RepoRewards.attach(proxyAddress);

  // Call the updateFeeParameters function
  console.log("Sending transaction...");
  const tx = await contractInstance.connect(owner).updateFeeParameters(
    feeCollectorAddress,
    platformFee,
    contributorFee,
    { 
      gasLimit: 500000,
      gasPrice: ethers.utils.parseUnits("25", "gwei")
    }
  );

  console.log(`Transaction sent: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  await tx.wait();

  console.log("Fee parameters updated successfully! ✅");

  // Optional: Verify by reading values back
  const readPlatformFee = await contractInstance.platformFeeRate();
  const readContributorFee = await contractInstance.contributorFeeRate();
  const readCollector = await contractInstance.feeCollector();
  console.log("Verification:");
  console.log(` - Current Platform Fee Rate: ${readPlatformFee.toString()}`);
  console.log(` - Current Contributor Fee Rate: ${readContributorFee.toString()}`);
  console.log(` - Current Fee Collector: ${readCollector}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 