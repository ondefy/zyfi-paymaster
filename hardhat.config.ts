import "@matterlabs/hardhat-zksync-ethers";
import "@matterlabs/hardhat-zksync-chai-matchers";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-node";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@nomicfoundation/hardhat-chai-matchers";

import type { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv"

dotenv.config()

const config: HardhatUserConfig = {
    defaultNetwork: "zkSyncSepoliaTestnet",
    networks: {
        zkSyncMainnet: {
            url: "https://mainnet.era.zksync.io",
            ethNetwork: "mainnet",
            zksync: true,
            verifyURL:
                // "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
                "https://explorer.zksync.io/",
        },
        zkSyncSepoliaTestnet: {
            url: "https://sepolia.era.zksync.dev",
            ethNetwork: "sepolia",
            zksync: true,
            verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
            // "https://sepolia-era.zksync.network"
        },
        cronosZkEvm: {
            url: "https://mainnet.zkevm.cronos.org",
            ethNetwork: "mainnet",
            zksync: true,
            verifyURL: "https://explorer-api.zkevm.cronos.org/api/v1/contract/verify/hardhat?apikey=QW5UgjuwXIJULlHi9ZY0i9vEqo72eNzX"
        },
        cronosZkEvmTestnet: {
            url: "https://testnet.zkevm.cronos.org",
            ethNetwork: "",
            zksync: true,
        },
        abstractTestnet: {
            url: "https://api.testnet.abs.xyz",
            ethNetwork: "",
            zksync: true,
            accounts: [`${process.env.WALLET_PRIVATE_KEY}`],
        },
        dockerizedNode: {
            url: "http://localhost:3050",
            ethNetwork: "http://localhost:8545",
            zksync: true,
        },
        inMemoryNode: {
            url: "http://127.0.0.1:8011",
            ethNetwork: "", // in-memory node doesn't support eth node; removing this line will cause an error
            zksync: true,
            // verifyURL: "http://localhost:3010/contract_verification",
        },
        hardhat: {
            zksync: true,
        },
    },
    zksolc: {
        version: "latest",
        settings: {
            // find all available options in the official documentation
            // https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-solc.html#configuration
        },
    },
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
};

export default config;
