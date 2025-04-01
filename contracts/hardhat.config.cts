import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ignition-ethers";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  paths: {
    sources: "./src/",
    tests: "./src/test",
    cache: "./src/cache",
    artifacts: "./src/artifacts",
  },
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;

