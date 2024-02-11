import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumberish, ethers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import * as hre from "hardhat";
import { Contract, Provider, Wallet } from "zksync-ethers";

import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import "@matterlabs/hardhat-zksync-verify/dist/src/type-extensions";
import { Address } from "zksync-ethers/build/src/types";

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
		provider,
	);

	return wallet;
};

export async function fundAccount(
	wallet: Wallet,
	address: string,
	amount: string,
) {
	await (
		await wallet.sendTransaction({
			to: address,
			value: ethers.utils.parseEther(amount),
		})
	).wait();
}

export const verifyEnoughBalance = async (
	wallet: Wallet,
	amount: BigNumberish,
) => {
	// Check if the wallet has enough balance
	const balance = await wallet.getBalance();
	if (balance.lt(amount))
		throw `⛔️ Wallet balance is too low! Required ${formatEther(
			amount,
		)} ETH, but current ${wallet.address} balance is ${formatEther(
			balance,
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
	options?: DeployContractOptions,
) => {
	const log = (message: string) => {
		if (!options?.silent) console.log(message);
	};

	log(`\nStarting deployment process of "${contractArtifactName}"...`);

	const wallet = options?.wallet ?? getWallet();
	const deployer = new Deployer(hre, wallet);
	const artifact = await deployer
		.loadArtifact(contractArtifactName)
		.catch((error) => {
			if (
				error?.message?.includes(
					`Artifact for contract "${contractArtifactName}" not found.`,
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
			constructorArguments || [],
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
		log(` - Contract address: ${contract.address}`);
		log(` - Contract source: ${fullContractSource}`);
		log(` - Encoded constructor arguments: ${constructorArgs}\n`);

		if (!options?.noVerify && hre.network.config.verifyURL) {
			log("Requesting contract verification...");
			await verifyContract({
				address: contract.address,
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
		contract = await hre.zkUpgrades.deployProxy(
			deployer.zkWallet,
			artifact,
			constructorArguments,
			{
				initializer: "initialize",
			},
		);
		await contract.deployed();
	}

	return contract;
};
