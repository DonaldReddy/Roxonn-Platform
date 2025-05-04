const hre = require("hardhat");

async function main() {
  console.log("Deploying CustomForwarder...");

  const CustomForwarder = await hre.ethers.getContractFactory("CustomForwarder");
  const forwarder = await CustomForwarder.deploy();
  await forwarder.waitForDeployment();

  const forwarderAddress = await forwarder.getAddress();
  console.log("CustomForwarder deployed to:", forwarderAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
