import axios from "axios";
import { expect, use } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, BigNumber } from "ethers";
import "@matterlabs/hardhat-zksync-chai-matchers";

import { deployContract, fundAccount, getTimestamp } from "./testHelpers";

import dotenv from "dotenv";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

const Whale =
  "0x850683b40d4a740aa6e745f889a6fdc8327be76e122f5aba645a5b02d0248db8";

// puublic address = "0x4826ed1D076f150eF2543F72160c23C7B519659a";
const Verifier_PK =
  "0x8f6e509395c13960f501bc7083450ffd0948bc94103433d5843e5060a91756da";

const GAS_LIMIT = 6_000_000;
const TX_EXPIRATION = 30 * 60; //30 minutes

describe("ERC20Paymaster", function () {
  let provider: Provider;
  let admin: Wallet;
  let whale: Wallet;
  let deployer: Deployer;
  let userWallet: Wallet;
  let verifier: Wallet;
  let initialBalance: BigNumber;
  let initialBalance_ERC20: BigNumber;
  let paymaster: Contract;
  let erc20: Contract;
  let helper: Contract;

  before(async function () {
    provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    whale = new Wallet(Whale, provider);
    admin =  Wallet.createRandom();
    deployer = new Deployer(hre, whale);
    verifier = new Wallet(Verifier_PK, provider);
    userWallet = Wallet.createRandom();
    console.log("Admin address: ", admin.address);
    console.log("Verifier address: ", verifier.address);
    console.log("User address: ", userWallet.address);
    userWallet = new Wallet(userWallet.privateKey, provider);
    initialBalance = await userWallet.getBalance();

    erc20 = await deployContract(deployer, "MockERC20", [
      "TestToken",
      "Test",
      18,
    ]);
    helper = await deployContract(deployer, "TestHelper", []);
    console.log("ERC20 address: ", erc20.address);

    console.log("Deploying Paymaster...");
    const contract = await deployer.loadArtifact("Paymaster");
    paymaster = await hre.zkUpgrades.deployProxy(deployer.zkWallet, contract, [ verifier.address], { initializer: "initialize" });

    await paymaster.deployed();
    // paymaster = await deployContract(deployer, "Paymaster", [verifier.address]);
    console.log("Paymaster address: ", paymaster.address);

    await fundAccount(whale, paymaster.address, "13");
    await (await erc20.mint(userWallet.address, 130)).wait();
    initialBalance_ERC20 = await erc20.balanceOf(userWallet.address);
  });

  async function executeTransaction(
    user: Wallet,
    token: Address,
    payType: "ApprovalBased" | "General",
    correctSignature: Boolean = true
  ) {
    const gasPrice = await provider.getGasPrice();
    const minimalAllowance = BigNumber.from(1);
    const expiration = BigNumber.from(
      (await helper.getTimestamp()).add(TX_EXPIRATION)
    );

    const messageHash = await getMessageHash(
      user.address,
      token,
      token,
      // used to test the wrong signature path
      correctSignature ? minimalAllowance : minimalAllowance.add(1),
      gasPrice,
      BigNumber.from(GAS_LIMIT)
    );

    const SignedMessageHash = await verifier.signMessage(
      ethers.utils.arrayify(messageHash)
    );
    const innerInput = ethers.utils.arrayify(SignedMessageHash);
    // console.log("Message hash: ", messageHash.toString());
    // console.log("Signed message hash: ", SignedMessageHash.toString());
    // console.log("User address: ", user.address.toString());
    // console.log("ERC20 address: ", token.toString());
    // console.log("Minimal allowance: ", minimalAllowance.toString());
    // console.log("Expiration: ", expiration.toString());
    // console.log("Max fee per gas: ", gasPrice.toString);
    // console.log("Gas limit: ", GAS_LIMIT.toString());
    // console.log("Inner input: ", innerInput);

    const paymasterParams = utils.getPaymasterParams(
      paymaster.address.toString(),
      {
        type: payType,
        token: token,
        minimalAllowance,
        innerInput,
      }
    );

    // console.log("Paymaster params: ", paymasterParams);

    await (
      await erc20.connect(userWallet).mint(user.address, 5, {
        maxPriorityFeePerGas: BigNumber.from(0),
        maxFeePerGas: gasPrice,
        gasLimit: GAS_LIMIT,
        customData: {
          paymasterParams: paymasterParams,
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        },
      })
    ).wait();
  }

  async function getMessageHash(
    _from: Address,
    _to: Address,
    _token: Address,
    _amount: BigNumber,
    _maxFeePerGas: BigNumber,
    _gasLimit: BigNumber
  ) {
    return ethers.utils.solidityKeccak256(
      ["address", "address", "address", "uint256", "uint256", "uint256"],
      [_from, _to, _token, _amount, _maxFeePerGas, _gasLimit]
    );
  }

  it("Initial parameters are correctly set", async function () {
    const verifierAddress = await paymaster.verifier();
    expect(verifierAddress).to.be.eql(verifier.address);
  });

  it("Should validate and pay for paymaster transaction", async function () {
    await executeTransaction(userWallet, erc20.address, "ApprovalBased");
    const newBalance = await userWallet.getBalance();
    const newBalance_ERC20 = await erc20.balanceOf(userWallet.address);
    expect(newBalance).to.be.eql(initialBalance);
    expect(newBalance_ERC20).to.be.eql(initialBalance_ERC20.add(4)); //5 minted - 1 fee
    expect(
      await erc20.allowance(userWallet.address, paymaster.address)
    ).to.be.eql(BigNumber.from(0));
  });

  it("Should not validate a wrong signature", async function () {
    await expect(
      executeTransaction(userWallet, erc20.address, "ApprovalBased", false)
    ).to.be.rejectedWith("Invalid signature");
  });

  it("should revert if unsupported paymaster flow", async function () {
    await expect(
      executeTransaction(userWallet, erc20.address, "General")
    ).to.be.rejectedWith("Unsupported paymaster flow");
  });

  it("should revert if allowance is too low", async function () {
    await fundAccount(whale, userWallet.address, "13");
    await erc20.approve(paymaster.address, BigNumber.from(0));
    try {
      await executeTransaction(userWallet, erc20.address, "ApprovalBased");
    } catch (e) {
      expect(e.message).to.include("Min allowance too low");
    }
  });

  it("Successfullly withdraw funds from paymaster", async function () {
    

  it.skip("Should call succesfully zyfi-api", async function () {
    const mintAmount = BigNumber.from(10);
    const txData = erc20.interface.encodeFunctionData("mint", [
      userWallet.address,
      mintAmount,
    ]);
    let data = JSON.stringify({
      feeTokenAddress: erc20.address,
      txData: {
        from: userWallet.address,
        to: erc20.address,
        value: 0,
        data: txData,
      },
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "http://localhost:3000/api/v1/generaltx",
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);
    // console.log("Response status:", response.status);
    // console.log(JSON.stringify(response.data));
    let rawTx = response.data.txData;
    console.log("Raw Transaction:", rawTx);
    // const successfulTx = await (
    //   await erc20.connect(userWallet).mint(userWallet, mintAmount, {
    //     maxFeePerGas: BigNumber.from(rawTx.maxFeePerGas),
    //     maxPriorityFeePerGas: BigNumber.from(rawTx.maxPriorityFeePerGas),
    //     gasLimit: rawTx.gasLimit,
    //     customData: {
    //       paymasterParams: {
    //         paymaster: paymaster.address,
    //         paymasterInput: rawTx.paymasterParams.paymasterInput,
    //       },
    //       gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    //     },
    //   })
    // ).wait();
    // expect(successfulTx.status).to.be.eql(1);

    const newBalance = await userWallet.getBalance();
    const newBalance_ERC20 = await erc20.balanceOf(userWallet.address);
    console.log("New Balance ERC20:", newBalance_ERC20.toString());
    expect(newBalance).to.be.eql(initialBalance);
    expect(newBalance_ERC20).to.be.eql(initialBalance_ERC20.add(mintAmount)); //5 minted - 1 fee
    expect(
      await erc20.allowance(userWallet.address, paymaster.address)
    ).to.be.eql(BigNumber.from(0));
  });
});
