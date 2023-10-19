import { HardhatUserConfig } from "hardhat/config"

import "@matterlabs/hardhat-zksync-deploy"
import "@matterlabs/hardhat-zksync-solc"
import "@matterlabs/hardhat-zksync-verify"
import "@matterlabs/hardhat-zksync-upgradable"
import "hardhat-interface-generator"

// load env file
import dotenv from "dotenv"
dotenv.config()

// dynamically changes endpoints for local tests
const zkSyncTestnet =
	process.env.NODE_ENV == "test"
		? {
				url: "http://localhost:8011",
				ethNetwork: "http://localhost:8545",
				zksync: true,
				allowUnlimitedContractSize: true,
				gas: 2100000,
				gasPrice: 8000000000,
		  }
		: {
				url: "https://testnet.era.zksync.dev",
				ethNetwork: "goerli",
				zksync: true,
				// contract verification endpoint
				verifyURL: "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
		  }

const zkSyncMainnet = {
	url: process.env.RPC_ZKSYNC!,
	ethNetwork: "mainnet",
	zksync: true,
	// contract verification endpoint
	verifyURL: "https://explorer.zksync.io/contracts/verify",
}

const config: HardhatUserConfig = {
	zksolc: {
		version: "latest",
		settings: {},
	},
	// defaults to zkSync network
	defaultNetwork: "zkSyncTestnet",
	networks: {
		hardhat: {
			zksync: true,
		},
		// load test network details
		zkSyncTestnet,
		zkSyncMainnet,
	},
	solidity: {
		version: "0.8.20",
	},
}

export default config

