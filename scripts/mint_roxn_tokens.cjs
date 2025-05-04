// Script to mint ROXN tokens through the proxy
const { ethers } = require("hardhat");
const hre = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Minting ROXN tokens...");

  // Get the minter account (must have MINTER_ROLE)
  const [minter] = await ethers.getSigners();
  console.log(`Minting with account: ${minter.address}`);

  // Address of the proxy contract
  const proxyAddress = process.env.ROXN_TOKEN_ADDRESS;
  console.log(`Using token proxy at: ${proxyAddress}`);

  // Get reference to the proxy
  const ROXNToken = await ethers.getContractFactory("ROXNToken");
  const proxiedToken = await ROXNToken.attach(proxyAddress);

  // Verify the minter has the MINTER_ROLE
  const hasMinterRole = await proxiedToken.hasRole(
    await proxiedToken.MINTER_ROLE(),
    minter.address
  );
  
  if (!hasMinterRole) {
    console.error("Error: Account does not have MINTER_ROLE");
    return;
  }
  
  console.log("Minter has MINTER_ROLE: true");

  // Address to receive the minted tokens
  // Convert XDC address format to standard Ethereum format if needed
  const targetAddress = "0xda7bc341428518d465463bf1880726c05ce28950";
  
  // Amount to mint (e.g., 100 ROXN = 100 * 10^18)
  const amount = ethers.parseEther("100");
  
  console.log(`Minting ${ethers.formatEther(amount)} ROXN to ${targetAddress}...`);
  
  // Mint tokens with explicit gas limit
  const tx = await proxiedToken.mint(targetAddress, amount, {
    gasLimit: 3000000
  });
  await tx.wait();

  // Verify the balance after minting
  const balance = await proxiedToken.balanceOf(targetAddress);
  
  console.log(`Tokens minted successfully!`);
  console.log(`New balance of ${targetAddress}: ${ethers.formatEther(balance)} ROXN`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 