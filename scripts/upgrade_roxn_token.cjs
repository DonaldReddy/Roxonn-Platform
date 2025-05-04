// Script to upgrade ROXN Token to a new implementation
const { ethers } = require("hardhat");

async function main() {
  console.log("Upgrading ROXN Token implementation...");

  // Get the deployer account (must have UPGRADER_ROLE)
  const [upgrader] = await ethers.getSigners();
  console.log(`Upgrading with account: ${upgrader.address}`);

  // Address of the proxy contract (replace with your actual proxy address)
  const proxyAddress = "0x..."; // Replace with your deployed proxy address

  // Get reference to the proxy
  const ROXNToken = await ethers.getContractFactory("ROXNToken");
  const proxiedToken = await ROXNToken.attach(proxyAddress);

  // Verify the upgrader has the UPGRADER_ROLE
  const hasUpgraderRole = await proxiedToken.hasRole(
    await proxiedToken.UPGRADER_ROLE(),
    upgrader.address
  );
  
  if (!hasUpgraderRole) {
    console.error("Error: Upgrader does not have UPGRADER_ROLE");
    return;
  }

  // Deploy new implementation
  console.log("Deploying new implementation...");
  const newImplementation = await ROXNToken.deploy();
  await newImplementation.deployed();
  console.log(`New implementation deployed at: ${newImplementation.address}`);

  // Upgrade the proxy to the new implementation
  // The upgradeTo function is part of UUPSUpgradeable
  const tx = await proxiedToken.upgradeTo(newImplementation.address);
  await tx.wait();

  console.log(`ROXN Token successfully upgraded to: ${newImplementation.address}`);
  console.log("Upgrade complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 