require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config({ path: './server/.env' });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200 // Standard value for optimization
      }
    }
  },
  networks: {
    xdcTestnet: {
      url: "https://erpc.apothem.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 51
    },
    xdcMainnet: {
      url: "https://rpc.xinfin.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50
    }
  },
  etherscan: {
    apiKey: {
      xdcTestnet: "no-api-key-needed",
      xdcMainnet: "no-api-key-needed"
    },
    customChains: [
      {
        network: "xdcTestnet",
        chainId: 51,
        urls: {
          apiURL: "https://apothem.blocksscan.io/api",
          browserURL: "https://apothem.blocksscan.io"
        }
      },
      {
        network: "xdcMainnet",
        chainId: 50,
        urls: {
          apiURL: "https://xdc.blocksscan.io/api",
          browserURL: "https://xdc.blocksscan.io"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./contracts/artifacts"
  }
};
