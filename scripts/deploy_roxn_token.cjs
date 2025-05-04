// Deployment script for ROXN Token with UUPS proxy pattern
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ROXN Token contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  // Deploy the implementation contract first with explicit gas limit
  const ROXNToken = await ethers.getContractFactory("ROXNToken");
  const roxnTokenImpl = await ROXNToken.deploy({
    gasLimit: 5000000
  });
  await roxnTokenImpl.waitForDeployment();
  const roxnTokenImplAddress = await roxnTokenImpl.getAddress();
  console.log(`ROXNToken implementation deployed to: ${roxnTokenImplAddress}`);

  // Prepare initialization data (encoded initialize function call)
  const adminAddress = deployer.address; // Using deployer as admin
  const initData = ROXNToken.interface.encodeFunctionData('initialize', [adminAddress]);

  // Deploy the proxy contract with the implementation address and initialization data
  const ROXNTokenProxy = await ethers.getContractFactory("ROXNTokenProxy");
  const roxnTokenProxy = await ROXNTokenProxy.deploy(roxnTokenImplAddress, initData, {
    gasLimit: 5000000
  });
  await roxnTokenProxy.waitForDeployment();
  const roxnTokenProxyAddress = await roxnTokenProxy.getAddress();
  console.log(`ROXNTokenProxy deployed to: ${roxnTokenProxyAddress}`);

  // Get a reference to the proxied token contract for interacting with it
  const proxiedToken = ROXNToken.attach(roxnTokenProxyAddress);
  console.log("ROXN Token deployment complete!");

  // Verify the roles were set correctly
  const hasAdminRole = await proxiedToken.hasRole(await proxiedToken.DEFAULT_ADMIN_ROLE(), adminAddress);
  const hasMinterRole = await proxiedToken.hasRole(await proxiedToken.MINTER_ROLE(), adminAddress);
  const hasPauserRole = await proxiedToken.hasRole(await proxiedToken.PAUSER_ROLE(), adminAddress);
  const hasUpgraderRole = await proxiedToken.hasRole(await proxiedToken.UPGRADER_ROLE(), adminAddress);
  
  console.log(`Admin has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
  console.log(`Admin has MINTER_ROLE: ${hasMinterRole}`);
  console.log(`Admin has PAUSER_ROLE: ${hasPauserRole}`);
  console.log(`Admin has UPGRADER_ROLE: ${hasUpgraderRole}`);
  
  console.log("");
  console.log("Contract Addresses (SAVE THESE):");
  console.log(`ROXNToken Implementation: ${roxnTokenImplAddress}`);
  console.log(`ROXNToken Proxy: ${roxnTokenProxyAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Update .env file with ROXN_TOKEN_ADDRESS=${roxnTokenProxyAddress}");
  console.log("2. Update the RepoRewards contract to use the new ROXN token");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 