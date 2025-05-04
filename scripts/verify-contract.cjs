require('dotenv').config({ path: './server/.env' });
const hre = require("hardhat");

async function main() {
    const provider = new hre.ethers.JsonRpcProvider(process.env.XDC_RPC_URL);
    
    console.log("\nChecking Contract Deployments:");
    console.log("-----------------------------");
    
    // Check RepoRewards contract
    console.log("\nRepoRewards Contract:");
    const repoRewardsAddress = process.env.REPO_REWARDS_CONTRACT_ADDRESS;
    console.log(`Address: ${repoRewardsAddress}`);
    const repoRewardsCode = await provider.getCode(repoRewardsAddress);
    console.log(`Deployed: ${repoRewardsCode !== '0x'}`);
    
    if (repoRewardsCode === '0x') {
        console.log("WARNING: RepoRewards contract not found at specified address!");
    }
    
    // Check Forwarder contract
    console.log("\nForwarder Contract:");
    const forwarderAddress = process.env.FORWARDER_CONTRACT_ADDRESS;
    console.log(`Address: ${forwarderAddress}`);
    const forwarderCode = await provider.getCode(forwarderAddress);
    console.log(`Deployed: ${forwarderCode !== '0x'}`);
    
    if (forwarderCode === '0x') {
        console.log("WARNING: Forwarder contract not found at specified address!");
    }
    
    // Check network
    const network = await provider.getNetwork();
    console.log("\nNetwork Info:");
    console.log(`Chain ID: ${network.chainId}`);
    
    // Check relayer
    const relayerWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const relayerBalance = await provider.getBalance(relayerWallet.address);
    console.log("\nRelayer Info:");
    console.log(`Address: ${relayerWallet.address}`);
    console.log(`Balance: ${hre.ethers.formatEther(relayerBalance)} XDC`);
    
    // Get gas price
    const feeData = await provider.getFeeData();
    console.log("\nGas Info:");
    console.log(`Current gas price: ${hre.ethers.formatEther(feeData.gasPrice)} XDC`);
    console.log(`Estimated gas cost for 300k gas: ${hre.ethers.formatEther(feeData.gasPrice * 300000n)} XDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
