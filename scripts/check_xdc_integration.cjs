const { ethers } = require("ethers");
require("dotenv").config({ path: "./server/.env" });
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Checking XDC Integration...");

  // 1. Connect to XDC Testnet
  const provider = new ethers.JsonRpcProvider(process.env.XDC_RPC_URL);
  console.log(`Connected to XDC Testnet at: ${process.env.XDC_RPC_URL}`);

  // 2. Load wallet using private key
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // 3. Get balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`XDC Balance: ${ethers.formatEther(balance)} XDC`);

  // 4. Load contract ABI
  const contractPath = path.join(__dirname, "../contracts/artifacts/contracts/ROXNToken.sol/ROXNToken.json");
  const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const abi = contractJson.abi;

  // 5. Create contract instance
  const tokenAddress = process.env.ROXN_TOKEN_ADDRESS;
  const contract = new ethers.Contract(tokenAddress, abi, wallet);
  console.log(`Loaded contract at address: ${tokenAddress}`);

  // 6. Try to interact with the contract
  try {
    // Basic calls that should work for any ERC20
    console.log("\nAttempting to call basic ERC20 functions...");
    
    const name = await contract.name();
    console.log(`Token Name: ${name}`);
    
    const symbol = await contract.symbol();
    console.log(`Token Symbol: ${symbol}`);
    
    const totalSupply = await contract.totalSupply();
    console.log(`Total Supply: ${ethers.formatEther(totalSupply)} ROXN`);
    
    // Token-specific calls
    console.log("\nAttempting to call ROXN-specific functions...");
    
    const maxSupply = await contract.MAX_SUPPLY();
    console.log(`Maximum Supply: ${ethers.formatEther(maxSupply)} ROXN`);
    
    const totalMinted = await contract.totalMinted();
    console.log(`Total Minted: ${ethers.formatEther(totalMinted)} ROXN`);
    
    const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE();
    const minterRole = await contract.MINTER_ROLE();
    
    const hasAdminRole = await contract.hasRole(defaultAdminRole, wallet.address);
    console.log(`Wallet has admin role: ${hasAdminRole}`);
    
    const hasMinterRole = await contract.hasRole(minterRole, wallet.address);
    console.log(`Wallet has minter role: ${hasMinterRole}`);
    
    console.log("\nXDC Integration Check Successful!");
  } catch (error) {
    console.error(`\nError interacting with contract: ${error.message}`);
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 