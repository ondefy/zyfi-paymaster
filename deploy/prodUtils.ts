import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumberish, ethers } from "ethers";
import * as hre from "hardhat";
import { Contract, Provider, Wallet } from "zksync-ethers";

import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import "@matterlabs/hardhat-zksync-verify/dist/src/type-extensions";
import { LOCAL_RICH_WALLETS } from "../test/testUtils";
import { formatEther, parseEther } from "@ethersproject/units";
import { Address } from "zksync-ethers/build/types";

export const getProvider = () => {
  const rpcUrl = hre.network.config.url;
  if (!rpcUrl)
    throw `⛔️ RPC URL wasn't found in "${hre.network.name}"! Please add a "url" field to the network config in hardhat.config.ts`;

  // Initialize zkSync Provider
  const provider = new Provider(rpcUrl);

  return provider;
};

export const getWallet = (privateKey?: string) => {
  if (!privateKey) {
    // Get wallet private key from .env file
    if (!process.env.WALLET_PRIVATE_KEY)
      throw "⛔️ Wallet private key wasn't found in .env file!";
  }

  const provider = getProvider();

  // Initialize zkSync Wallet
  const wallet = new Wallet(
    // biome-ignore lint/style/noNonNullAssertion: A check is performed above
    privateKey ?? process.env.WALLET_PRIVATE_KEY!,
    provider
  );

  return wallet;
};

export async function fundAccount(
  wallet: Wallet,
  address: string,
  amount: string
) {
  await (
    await wallet.sendTransaction({
      to: address,
      value: BigInt(parseEther(amount).toString()),
    })
  ).wait();
  console.log(`Funded ${address} with ${amount} ETH`);
}

export const verifyEnoughBalance = async (
  wallet: Wallet,
  amount: bigint
) => {
  // Check if the wallet has enough balance
  const balance = await wallet.getBalance();
  if (balance < amount)
    throw `⛔️ Wallet balance is too low! Required ${formatEther(
      amount
    )} ETH, but current ${wallet.address} balance is ${formatEther(
      balance
    )} ETH`;
};

/**
 * @param {string} data.contract The contract's path and name. E.g., "contracts/Greeter.sol:Greeter"
 */
export const verifyContract = async (data: {
  address: string;
  contract: string;
  constructorArguments: string;
  bytecode: string;
}) => {
  const verificationRequestId: number = await hre.run("verify:verify", {
    ...data,
    noCompile: true,
  });
  return verificationRequestId;
};

type DeployContractOptions = {
  /**
   * If true, the deployment process will not print any logs
   */
  silent?: boolean;
  /**
   * If true, the contract will not be verified on Block Explorer
   */
  noVerify?: boolean;
  /**
   * If specified, the contract will be deployed using this wallet
   */
  wallet?: Wallet;
  /**
   * If specified, the ownership of the contract will be transferred to this address
   */
  transferOwnership?: Address;
  /**
   * If true, the contract will be deployed using a deployProxy
   */
  proxy?: boolean;
};
export const deployContract = async (
  contractArtifactName: string,
  constructorArguments?: any[],
  options?: DeployContractOptions
) => {
  const log = (message: string) => {
    if (!options?.silent) console.log(message);
  };
  log(`\nStarting deployment process of "${contractArtifactName}"...`);

  const isLocalNetwork =
    hre.network.name === "zkSyncEraTestNode" ||
    hre.network.name === "inMemoryNode";
  const defaultPrivateKey = isLocalNetwork
    ? LOCAL_RICH_WALLETS[0].privateKey
    : undefined;
  const wallet: Wallet = options?.wallet ?? getWallet(defaultPrivateKey);

  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer
    .loadArtifact(contractArtifactName)
    .catch((error) => {
      if (
        error?.message?.includes(
          `Artifact for contract "${contractArtifactName}" not found.`
        )
      ) {
        console.error(error.message);
        throw "⛔️ Please make sure you have compiled your contracts or specified the correct contract name!";
      }
      throw error;
    });

  let contract: Contract;

  if (!options?.proxy) {
    // Estimate contract deployment fee
    const deploymentFee = await deployer.estimateDeployFee(
      artifact,
      constructorArguments || []
    );
    log(`Estimated deployment cost: ${formatEther(deploymentFee)} ETH`);

    // Check if the wallet has enough balance
    await verifyEnoughBalance(wallet, deploymentFee);

    // Deploy the contract to zkSync
    contract = await deployer.deploy(artifact, constructorArguments);
    const constructorArgs =
      contract.interface.encodeDeploy(constructorArguments);
    const fullContractSource = `${artifact.sourceName}:${artifact.contractName}`;

    // Display contract deployment info
    log(`\n"${artifact.contractName}" was successfully deployed:`);
    log(` - Contract address: ${await contract.getAddress()}`);
    log(` - Contract source: ${fullContractSource}`);
    log(` - Encoded constructor arguments: ${constructorArgs}\n`);

    if (!options?.noVerify && hre.network.config.verifyURL) {
      log("Requesting contract verification...");
      await verifyContract({
        address: await contract.getAddress(),
        contract: fullContractSource,
        constructorArguments: constructorArgs,
        bytecode: artifact.bytecode,
      });
    }

    if (options?.transferOwnership) {
      log(`Transferring ownership to ${options.transferOwnership}...`);
      await contract.transferOwnership(options.transferOwnership);
    }
  } // Proxy path
  else {
    // // Estimate contract deployment fee - Only for mainnet
    // const deploymentFee = await hre.zkUpgrades.estimation.estimateGasProxy(
    // 	deployer,
    // 	artifact,
    // 	[],
    // 	{ kind: "uups" },
    // );

    // console.log(`Estimated deployment cost: ${formatEther(deploymentFee)} ETH`);

    // // Check if the wallet has enough balance
    // await verifyEnoughBalance(wallet, deploymentFee);

    // Deploy the contract to zkSync
    // contract = await hre.zkUpgrades.deployProxy(
    //   deployer.zkWallet,
    //   artifact,
    //   constructorArguments,
    //   {
    //     initializer: "initialize",
    //   }
    // );
    // await contract.deployed();
    throw Error("zkUpgrades")
  }

  return contract;
};

export async function getUserNonce(address) {
  // This assumes you have already set up your Hardhat environment and you're calling this within an async function

  // Get the provider from Hardhat's environment
  const provider = getProvider();

  // Use the provider to get the nonce for the specified address
  const nonce = await provider.getTransactionCount(address);

  // console.log(`Nonce for address ${address} is: ${nonce}`);
  return nonce;
}
