// Simple script to test minting ROXN tokens to your own address
const { ethers } = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Running ROXN Token Test Mint...");

  // Get the current network to confirm we're on testnet
  const network = await ethers.provider.getNetwork();
  console.log(`Connected to network with chain ID: ${network.chainId}`);
  
  if (network.chainId !== 51) {
    console.warn("WARNING: Not connected to XDC Testnet (Chain ID 51).");
    console.warn("Are you sure you want to continue? (Ctrl+C to abort)");
  }

  // Get the minter account (must have MINTER_ROLE)
  const [minter] = await ethers.getSigners();
  console.log(`Using account: ${minter.address}`);

  // Get XDC balance
  const xdcBalance = await ethers.provider.getBalance(minter.address);
  console.log(`XDC Balance: ${ethers.formatEther(xdcBalance)} XDC`);

  // Address of the proxy contract
  const proxyAddress = process.env.ROXN_TOKEN_ADDRESS;
  if (!proxyAddress) {
    console.error("Error: ROXN_TOKEN_ADDRESS not set in .env file");
    return;
  }
  console.log(`Using token proxy at: ${proxyAddress}`);

  // Get reference to the proxy
  const ROXNToken = await ethers.getContractFactory("ROXNToken");
  const proxiedToken = await ROXNToken.attach(proxyAddress);

  // Get token info
  const name = await proxiedToken.name();
  const symbol = await proxiedToken.symbol();
  console.log(`Token: ${name} (${symbol})`);

  // Verify the minter has the MINTER_ROLE
  const hasMinterRole = await proxiedToken.hasRole(
    await proxiedToken.MINTER_ROLE(),
    minter.address
  );
  
  if (!hasMinterRole) {
    console.error("Error: Account does not have MINTER_ROLE");
    return;
  }
  
  console.log("✅ Account has MINTER_ROLE");

  // Get current balance
  const currentBalance = await proxiedToken.balanceOf(minter.address);
  console.log(`Current ROXN balance: ${ethers.formatEther(currentBalance)} ROXN`);

  // Amount to mint (100 ROXN for testing)
  const amount = ethers.parseEther("100");
  
  console.log(`\nMinting ${ethers.formatEther(amount)} ROXN to your address (${minter.address})...`);
  
  try {
    // Mint tokens with explicit gas limit
    const tx = await proxiedToken.mint(minter.address, amount, {
      gasLimit: 300000
    });
    
    console.log(`Transaction submitted: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    // Wait for the transaction to be mined
    await tx.wait();
    
    console.log("✅ Transaction confirmed!");

    // Verify the balance after minting
    const newBalance = await proxiedToken.balanceOf(minter.address);
    console.log(`\nNew ROXN balance: ${ethers.formatEther(newBalance)} ROXN`);
    
    // Calculate the difference to verify
    const difference = newBalance - currentBalance;
    if (difference.toString() === amount.toString()) {
      console.log("✅ Test mint successful! Balance increased by exactly 100 ROXN.");
    } else {
      console.log(`⚠️ Balance increased by ${ethers.formatEther(difference)} ROXN, expected 100 ROXN.`);
    }
  } catch (error) {
    console.error(`\n❌ Error during minting: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 