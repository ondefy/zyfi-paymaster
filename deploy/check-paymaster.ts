import "@matterlabs/hardhat-zksync-chai-matchers";
import { BigNumber, ethers } from "ethers";
import { network, run } from "hardhat";
import {
	Contract,
	Provider,
	Wallet,
	Web3Provider,
	types,
	utils,
} from "zksync-ethers";
import { Address } from "zksync-ethers/build/src/types";
import { IERC20, IPaymasterFlow } from "zksync-ethers/build/src/utils";

const SLEEP_MILLISECONDS = 120000;

async function sleep() {
	console.log("start sleep " + SLEEP_MILLISECONDS + " milliSeconds");
	await new Promise((resolve) => setTimeout(resolve, SLEEP_MILLISECONDS));
	console.log("end sleep");
}

let provider: Provider;
let paymaster: Contract;
let erc20: Contract;
let signer: Address;

let user: Wallet;
//Grai
const ERC20Address: Address = "0x5FC44E95eaa48F9eB84Be17bd3aC66B6A82Af709";
const spenderAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";
const newSignerAddress: Address = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";

// Put the address of the deployed paymaster here
const PAYMASTER_ADDRESS = "0x9702beC6668A94619a9c3cfef0e220512FbEEfbd";

const paymasterArtifact = require("../artifacts-zk/contracts/ERC20Paymaster.sol/Paymaster.json");
provider = new Provider(process.env.RPC_ZKSYNC!);
paymaster = new Contract(PAYMASTER_ADDRESS, paymasterArtifact.abi, provider);

//create async function
async function getSigner() {
	// const ethProvider = require("eth-provider"); // eth-provider is a simple EIP-1193 provider
	// const frame = Web3Provider("frame"); // Connect to Frame
	// frame.setChain(324); // <- change this line for any desired chain id

	console.log("Paymaster:", paymaster.address);
	signer = await paymaster.verifier();
	console.log("Signer:", signer);
	// await paymaster.setVerifier(newSignerAddress)
}
getSigner();
// describe("Check existing paymaster", function () {
// 	it("Check signer address", async function () {

// 	})
// })
