import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'dotenv/config'

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    amoy:{
      url: ETHEREUM_RPC_URL,
      accounts: [process.env.PRIVATE_KEY || ""],
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  }
};

export default config;
