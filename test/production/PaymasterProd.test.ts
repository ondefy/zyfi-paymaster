import "@matterlabs/hardhat-zksync-chai-matchers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import axios from "axios";
import { expect, use } from "chai";
import { BigNumber, ethers, utils } from "ethers";
import * as hre from "hardhat";
import { Contract, Provider, Wallet, types } from "zksync-ethers";
import { Address } from "zksync-ethers/build/src/types";
import { IERC20 } from "zksync-ethers/build/src/utils";
import { IPaymaster } from "zksync-ethers/build/src/utils";

const allowanceAmount = BigNumber.from(110);

let provider: Provider;
let erc20: Contract;
let paymaster: Contract;
let user: Wallet;
//Grai
const PAYMASTER_ADDRESS = "0x9702beC6668A94619a9c3cfef0e220512FbEEfbd";
const ERC20Address: Address = "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4";
const spenderAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";
const PaymasterABI = [
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "previousAdmin",
				type: "address",
			},
			{
				indexed: false,
				internalType: "address",
				name: "newAdmin",
				type: "address",
			},
		],
		name: "AdminChanged",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "beacon",
				type: "address",
			},
		],
		name: "BeaconUpgraded",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint8",
				name: "version",
				type: "uint8",
			},
		],
		name: "Initialized",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "previousOwner",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "newOwner",
				type: "address",
			},
		],
		name: "OwnershipTransferred",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "implementation",
				type: "address",
			},
		],
		name: "Upgraded",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "newVerifier",
				type: "address",
			},
		],
		name: "VerifierChanged",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newImplementation",
				type: "address",
			},
		],
		name: "authorizeUpgrade",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_verifier",
				type: "address",
			},
		],
		name: "initialize",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "owner",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "bytes",
				name: "_context",
				type: "bytes",
			},
			{
				components: [
					{
						internalType: "uint256",
						name: "txType",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "from",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "to",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "gasLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "gasPerPubdataByteLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxFeePerGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxPriorityFeePerGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "paymaster",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "nonce",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "value",
						type: "uint256",
					},
					{
						internalType: "uint256[4]",
						name: "reserved",
						type: "uint256[4]",
					},
					{
						internalType: "bytes",
						name: "data",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "signature",
						type: "bytes",
					},
					{
						internalType: "bytes32[]",
						name: "factoryDeps",
						type: "bytes32[]",
					},
					{
						internalType: "bytes",
						name: "paymasterInput",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "reservedDynamic",
						type: "bytes",
					},
				],
				internalType: "struct Transaction",
				name: "_transaction",
				type: "tuple",
			},
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
			{
				internalType: "enum ExecutionResult",
				name: "_txResult",
				type: "uint8",
			},
			{
				internalType: "uint256",
				name: "_maxRefundedGas",
				type: "uint256",
			},
		],
		name: "postTransaction",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [],
		name: "proxiableUUID",
		outputs: [
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "renounceOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_newVerifier",
				type: "address",
			},
		],
		name: "setVerifier",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newOwner",
				type: "address",
			},
		],
		name: "transferOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newImplementation",
				type: "address",
			},
		],
		name: "upgradeTo",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "newImplementation",
				type: "address",
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes",
			},
		],
		name: "upgradeToAndCall",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32",
			},
			{
				components: [
					{
						internalType: "uint256",
						name: "txType",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "from",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "to",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "gasLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "gasPerPubdataByteLimit",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxFeePerGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "maxPriorityFeePerGas",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "paymaster",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "nonce",
						type: "uint256",
					},
					{
						internalType: "uint256",
						name: "value",
						type: "uint256",
					},
					{
						internalType: "uint256[4]",
						name: "reserved",
						type: "uint256[4]",
					},
					{
						internalType: "bytes",
						name: "data",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "signature",
						type: "bytes",
					},
					{
						internalType: "bytes32[]",
						name: "factoryDeps",
						type: "bytes32[]",
					},
					{
						internalType: "bytes",
						name: "paymasterInput",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "reservedDynamic",
						type: "bytes",
					},
				],
				internalType: "struct Transaction",
				name: "_transaction",
				type: "tuple",
			},
		],
		name: "validateAndPayForPaymasterTransaction",
		outputs: [
			{
				internalType: "bytes4",
				name: "magic",
				type: "bytes4",
			},
			{
				internalType: "bytes",
				name: "context",
				type: "bytes",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [],
		name: "verifier",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address payable",
				name: "_to",
				type: "address",
			},
		],
		name: "withdraw",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "_ERC20",
				type: "address",
			},
		],
		name: "withdrawERC20",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		stateMutability: "payable",
		type: "receive",
	},
];
provider = new Provider(process.env.RPC_ZKSYNC!);
// provider = new Provider("https://mainnet.era.zksync.io")
console.log("Provider:", provider.connection.url);
user = new Wallet(process.env.DEPLOYER!, provider);
erc20 = new Contract(ERC20Address, IERC20, provider);
paymaster = new Contract(PAYMASTER_ADDRESS, PaymasterABI, provider);
// Create a Frame connection
const ethProvider = require("eth-provider"); // eth-provider is a simple EIP-1193 provider
const frame = ethProvider("frame"); // Connect to Frame

describe("ERC20PaymasterProd", () => {
	it("Successfully use tokenapprovaltx", async () => {
		const data = JSON.stringify({
			from: user.address,
			spender: spenderAddress,
			tokenAddress: erc20.address,
			allowanceAmount: allowanceAmount.toString(),
		});

		const config = {
			method: "post",
			// url: "https://paymaster.zyfi.org/api/v1/tokenapprovaltx",
			url: "http://localhost:3000/api/v1/tokenapprovaltx",
			maxBodyLength: Infinity,
			headers: {
				"Content-Type": "application/json",
			},
			data: data,
		};

		console.log(
			"Wallet balance:",
			ethers.utils.formatEther(await user.getBalance()),
		);
		let txData: types.TransactionRequest;
		let responseData: any;
		try {
			const response = await axios.request(config);
			console.log("Response Data:", JSON.stringify(response.data));
			txData = response.data.txData;
			console.log("TxData:", txData);
		} catch (error) {
			console.error("Axios Error:", error);
			throw error; // This will cause the test to fail if there's an error.
		}

		const signedTx = await (await user.sendTransaction(txData)).wait();
		// const signedTx = await user.signTransaction(txData)
		// const tx = await provider.sendTransaction(signedTx)
		console.log("Signed Tx:", signedTx);
		// const tx = await provider.sendTransaction(signedTx)
		// console.log("Tx:", tx)
	});

	it("Check addresses", async () => {
		const verifier = await paymaster.connect(user).verifier();
		console.log("Verifier:", verifier);
		const owner = await paymaster.owner();
		console.log("Owner:", owner);
	});

	it.only("Change verifier", async () => {
		const verifier = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";
		// Use `getDeployTransaction` instead of `deploy` to return deployment data
		const tx = await paymaster.populateTransaction.setVerifier(verifier);

		// Set `tx.from` to current Frame account
		tx.from = (await frame.request({ method: "eth_requestAccounts" }))[7];
		tx.chainId = 324;
		console.log("Tx:", tx);
		console.log("Tx from:", tx.from);

		// Sign and send the transaction using Frame
		await frame.request({ method: "eth_sendTransaction", params: [tx] });
		// const txData = await paymaster.connect(user).withdrawERC20(ERC20Address)
	});

	it("Generate ERC20 withdrawal transaction data", async () => {
		const ERC20Address = "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4";
		// Use `getDeployTransaction` instead of `deploy` to return deployment data
		const tx = await paymaster.populateTransaction.withdrawERC20(ERC20Address);

		// Set `tx.from` to current Frame account
		tx.from = (await frame.request({ method: "eth_requestAccounts" }))[7];
		tx.chainId = 324;
		console.log("Tx:", tx);
		console.log("Tx from:", tx.from);

		// Sign and send the transaction using Frame
		await frame.request({ method: "eth_sendTransaction", params: [tx] });
		// const txData = await paymaster.connect(user).withdrawERC20(ERC20Address)
	});

	it("Check approval", async () => {
		const ERC20Allowance = await erc20.allowance(user.address, spenderAddress);
		console.log("ERC20Allowance:", ERC20Allowance.toString());
		expect(ERC20Allowance).to.equal(allowanceAmount);
	});

	it("Check input data", async () => {
		const inputData =
			"0x3f464b160000000000000000000000000000000000000000000000000000000001fb95b400000000000000000000000000000000000000000000000000419474a6d536b000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000557803478714857536107409c0c08cd6082832c000000000000000000000000000000000000000000000000000000006539053e000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000020000000000000000000000003355df6d4c9c3035724fd0e3914de96a5a83aaf40000000000000000000000005aea5775959fbc2557cc8789bc1bf90a239d9a91000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

		const { token, amount, data } = ethers.utils.defaultAbiCoder.decode(
			["address", "uint256", "bytes"],
			inputData,
		);
		console.log("Token:", token);
		console.log("Amount:", amount);
		console.log("Data:", data);
	});
});
