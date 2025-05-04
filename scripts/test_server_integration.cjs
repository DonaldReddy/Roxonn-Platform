const { ethers } = require("ethers");
require("dotenv").config({ path: "./server/.env" });
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Testing Server Integration with ROXN Token...");

  // 1. Connect to XDC Testnet with alternative RPC URL
  const rpcUrl = "https://erpc.apothem.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  console.log(`Connected to XDC Testnet at: ${rpcUrl}`);

  // 2. Load wallet using private key (this simulates the server's wallet)
  const serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Server wallet address: ${serverWallet.address}`);

  // 3. Create test user wallet (this simulates a user wallet)
  const testUserWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`Test user wallet address: ${testUserWallet.address}`);

  // 4. Load contract ABIs
  const roxnTokenPath = path.join(__dirname, "../contracts/artifacts/contracts/ROXNToken.sol/ROXNToken.json");
  const roxnTokenJson = JSON.parse(fs.readFileSync(roxnTokenPath, "utf8"));
  const roxnTokenAbi = roxnTokenJson.abi;

  const repoRewardsPath = path.join(__dirname, "../contracts/artifacts/contracts/RepoRewards.sol/RepoRewards.json");
  const repoRewardsJson = JSON.parse(fs.readFileSync(repoRewardsPath, "utf8"));
  const repoRewardsAbi = repoRewardsJson.abi;

  // 5. Create contract instances
  const tokenAddress = process.env.ROXN_TOKEN_ADDRESS;
  const tokenContract = new ethers.Contract(tokenAddress, roxnTokenAbi, serverWallet);
  console.log(`Loaded ROXN token contract at: ${tokenAddress}`);

  const repoRewardsAddress = process.env.REPO_REWARDS_CONTRACT_ADDRESS;
  const repoRewardsContract = new ethers.Contract(repoRewardsAddress, repoRewardsAbi, serverWallet);
  console.log(`Loaded RepoRewards contract at: ${repoRewardsAddress}`);

  // 6. Test token operations
  try {
    console.log("\n--- Testing Basic Token Operations ---");
    
    // Check server wallet token balance
    const serverBalance = await tokenContract.balanceOf(serverWallet.address);
    console.log(`Server wallet ROXN balance: ${ethers.formatEther(serverBalance)} ROXN`);

    // Mint some tokens to the test user (simulating reward distribution)
    const mintAmount = ethers.parseEther("1"); // Mint 1 ROXN token for testing
    console.log(`Minting ${ethers.formatEther(mintAmount)} ROXN to test user...`);
    
    const mintTx = await tokenContract.mint(testUserWallet.address, mintAmount);
    await mintTx.wait();
    console.log(`Mint transaction hash: ${mintTx.hash}`);
    
    // Check user balance after minting
    const userBalance = await tokenContract.balanceOf(testUserWallet.address);
    console.log(`Test user wallet ROXN balance: ${ethers.formatEther(userBalance)} ROXN`);
    
    // Check if test was successful
    if (userBalance >= mintAmount) {
      console.log("\n🎉 Token Integration Test Successful! 🎉");
      console.log("Successfully minted ROXN tokens to a test user wallet on XDC Testnet");
      console.log("This confirms that server-side code can interact with the token contract");
    } else {
      console.error("\n❌ Token Integration Test Failed ❌");
      console.error("Token balance doesn't match expected amount after minting");
    }

  } catch (error) {
    console.error(`\nError during integration test: ${error.message}`);
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 