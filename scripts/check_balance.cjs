// Script to check ROXN token balance through the proxy
const { ethers } = require("hardhat");
const hre = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Checking ROXN token balance...");

  // Get the account to check from
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Address of the proxy contract
  const proxyAddress = process.env.ROXN_TOKEN_ADDRESS;
  console.log(`Using token proxy at: ${proxyAddress}`);

  // Get reference to the proxy
  const ROXNToken = await ethers.getContractFactory("ROXNToken");
  const proxiedToken = await ROXNToken.attach(proxyAddress);

  // Pool manager address
  const poolManagerAddress = "0x055965160e1fc96b2f561075e703717f574f04b8";
  
  // Check balance
  const balance = await proxiedToken.balanceOf(poolManagerAddress);
  
  console.log(`ROXN Balance for pool manager (${poolManagerAddress}): ${ethers.formatEther(balance)} ROXN`);
  
  // Also check the total supply
  const totalSupply = await proxiedToken.totalSupply();
  console.log(`Total ROXN Supply: ${ethers.formatEther(totalSupply)} ROXN`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 