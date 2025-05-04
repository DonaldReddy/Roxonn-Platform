const { ethers } = require("hardhat");
require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log("Verifying ROXN Token on XDC Testnet...");
  
  // Get provider
  const provider = new ethers.JsonRpcProvider(process.env.XDC_RPC_URL);
  console.log(`Connected to XDC Testnet at: ${process.env.XDC_RPC_URL}`);
  
  // Get network info
  const network = await provider.getNetwork();
  console.log(`Network Chain ID: ${network.chainId}`);
  
  // Check if the contract exists
  const proxyAddress = process.env.ROXN_TOKEN_ADDRESS;
  const implAddress = process.env.ROXN_TOKEN_IMPL_ADDRESS;
  
  console.log(`\nChecking ROXN Token Proxy at: ${proxyAddress}`);
  const proxyCode = await provider.getCode(proxyAddress);
  console.log(`Contract deployed: ${proxyCode !== '0x'}`);
  
  console.log(`\nChecking ROXN Token Implementation at: ${implAddress}`);
  const implCode = await provider.getCode(implAddress);
  console.log(`Contract deployed: ${implCode !== '0x'}`);
  
  // Try to get an instance of the contract
  try {
    const [signer] = await ethers.getSigners();
    console.log(`\nUsing signer: ${signer.address}`);
    
    // Get contract factory and attach to proxy address
    const ROXNToken = await ethers.getContractFactory("ROXNToken");
    const proxiedToken = ROXNToken.attach(proxyAddress);
    
    // Try to call basic functions
    console.log("\nBasic Contract Information:");
    console.log("--------------------------");
    
    try {
      const name = await proxiedToken.name();
      console.log(`Token Name: ${name}`);
    } catch (error) {
      console.error(`Error getting token name: ${error.message}`);
    }
    
    try {
      const symbol = await proxiedToken.symbol();
      console.log(`Token Symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error getting token symbol: ${error.message}`);
    }
    
    try {
      const totalSupply = await proxiedToken.totalSupply();
      console.log(`Total Supply: ${ethers.formatEther(totalSupply)} ROXN`);
    } catch (error) {
      console.error(`Error getting total supply: ${error.message}`);
    }
    
    try {
      const maxSupply = await proxiedToken.MAX_SUPPLY();
      console.log(`Max Supply: ${ethers.formatEther(maxSupply)} ROXN`);
    } catch (error) {
      console.error(`Error getting max supply: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`\nError interacting with contract: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 