import axios from "axios"
import { expect, use } from "chai"
import { Wallet, Provider, Contract, utils, types } from "zksync-web3"
import * as hre from "hardhat"
import { Deployer } from "@matterlabs/hardhat-zksync-deploy"
import { ethers, BigNumber } from "ethers"
import "@matterlabs/hardhat-zksync-chai-matchers"
import { Address } from "zksync-web3/build/src/types"
import { IERC20 } from "zksync-web3/build/src/utils"

import dotenv from "dotenv"
dotenv.config()

const allowanceAmount = BigNumber.from(100)

let provider: Provider
let erc20: Contract
let user: Wallet
//Grai
let ERC20Address: Address = "0x5FC44E95eaa48F9eB84Be17bd3aC66B6A82Af709"
let spenderAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565"

// provider = new Provider(process.env.RPC_ZKSYNC!)
provider = new Provider("https://mainnet.era.zksync.io")
console.log("Provider:", provider.connection.url)
user = new Wallet(process.env.DEPLOYER!, provider)
erc20 = new Contract(ERC20Address, IERC20, provider)

describe("ERC20PaymasterProd", function () {
	it("Successfully use tokenapprovaltx", async function () {
		let data = JSON.stringify({
			from: user.address,
			spender: spenderAddress,
			tokenAddress: erc20.address,
			allowanceAmount: allowanceAmount.toString(),
		})

		let config = {
			method: "post",
			maxBodyLength: Infinity,
			url: "https://paymaster.zyfi.org/api/v1/tokenapprovaltx",
			headers: {
				"Content-Type": "application/json",
			},
			data: data,
		}

		console.log("Wallet balance:", ethers.utils.formatEther(await user.getBalance()))
		let txData: types.TransactionRequest
		// let responseData: any
		// try {
		// 	const response = await axios.request(config)
		// 	console.log("Response Data:", JSON.stringify(response.data))
		// 	responseData = response.data
		// } catch (error) {
		// 	console.error("Axios Error:", error)
		// 	throw error // This will cause the test to fail if there's an error.
		// }
		txData = {
			to: "0x5FC44E95eaa48F9eB84Be17bd3aC66B6A82Af709",
			from: "0xFb8257B797cA0f4d2c77279797D6ddaA027BEE00",
			value: BigNumber.from("0"),
			data: "0x095ea7b3000000000000000000000000eaca6db0aee62c87a69c3d6bcf6bccc9388b75650000000000000000000000000000000000000000000000000000000000000064",
			customData: {
				paymasterParams: {
					paymaster: "0x9702beC6668A94619a9c3cfef0e220512FbEEfbd",
					paymasterInput:
						"0x949431dc0000000000000000000000005fc44e95eaa48f9eb84be17bd3ac66b6a82af709000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000041c936ad5ea2e56ec23dfeacb7b97f1ea128687a1451bffa34beff14de1a8b7c53099219d5a61978aa13f0f6e125a6d9be915e02f0374ebf9ff848117904e1e38b1b00000000000000000000000000000000000000000000000000000000000000",
				},
				gasPerPubdata: BigNumber.from("50000"),
			},
			maxFeePerGas: BigNumber.from("2000000000"),
			maxPriorityFeePerGas: BigNumber.from("1500000000"),
			gasLimit: BigNumber.from("298260"),
		}

		if (isValidTransactionRequest(txData)) {
			console.log("txData is valid")
		} else {
			console.log("txData is invalid")
		}

		// console.log("TxData:", txData)
		const signedTx = await user.signTransaction(txData)
		console.log("Signed Tx:", signedTx)
		// const tx = await provider.sendTransaction(signedTx)
		// console.log("Tx:", tx)
		const ERC20Allowance = await erc20.allowance(user.address, spenderAddress)
		console.log("ERC20Allowance:", ERC20Allowance)
		expect(ERC20Allowance).to.equal(allowanceAmount)
	})
})

function isValidTransactionRequest(txData: any): txData is types.TransactionRequest {
	let isValid = true

	// Basic checks for required fields
	if (typeof txData.from !== "string") {
		console.error("Invalid 'from' field: Expected a string.")
		isValid = false
	}

	if (typeof txData.to !== "string") {
		console.error("Invalid 'to' field: Expected a string.")
		isValid = false
	}

	if (!(txData.value instanceof BigNumber)) {
		console.error("Invalid 'value' field: Expected a BigNumber instance.")
		isValid = false
	}

	if (typeof txData.data !== "string") {
		console.error("Invalid 'data' field: Expected a string.")
		isValid = false
	}

	if (typeof txData.maxFeePerGas !== "object" || !(txData.maxFeePerGas instanceof BigNumber)) {
		console.error("Invalid 'maxFeePerGas' field: Expected a BigNumber instance.")
		isValid = false
	}

	if (typeof txData.maxPriorityFeePerGas !== "object" || !(txData.maxPriorityFeePerGas instanceof BigNumber)) {
		console.error("Invalid 'maxPriorityFeePerGas' field: Expected a BigNumber instance.")
		isValid = false
	}

	if (typeof txData.gasLimit !== "object" || !(txData.gasLimit instanceof BigNumber)) {
		console.error("Invalid 'gasLimit' field: Expected a BigNumber instance.")
		isValid = false
	}

	// Add more checks for nested fields or other properties as required...

	return isValid
}

