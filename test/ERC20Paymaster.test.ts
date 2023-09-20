import { expect } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as ethers from "ethers";
import "@matterlabs/hardhat-zksync-chai-matchers";

import { deployContract, fundAccount, getTimestamp } from "./testHelpers";

import dotenv from "dotenv";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

const Whale =
  "0x850683b40d4a740aa6e745f889a6fdc8327be76e122f5aba645a5b02d0248db8";
const Signer_PK =
  "0x8f6e509395c13960f501bc7083450ffd0948bc94103433d5843e5060a91756da";
const Signer = "0x4826ed1D076f150eF2543F72160c23C7B519659a";

const GAS_LIMIT = 6_000_000;
const TX_EXPIRATION = 30 * 60; //30 minutes

describe("ERC20Paymaster", function () {
  let provider: Provider;
  let whale: Wallet;
  let deployer: Deployer;
  let userWallet: Wallet;
  let signer: Wallet;
  let initialBalance: ethers.BigNumber;
  let initialBalance_ERC20: ethers.BigNumber;
  let paymaster: Contract;
  let erc20: Contract;
  let helper: Contract;

  before(async function () {
    provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    whale = new Wallet(Whale, provider);
    deployer = new Deployer(hre, whale);
    signer = new Wallet(Signer_PK, provider);
    userWallet = Wallet.createRandom();
    userWallet = new Wallet(userWallet.privateKey, provider);
    // console.log("Private key: ", userWallet.privateKey);
    // console.log("Public key: ", userWallet.address);
    initialBalance = await userWallet.getBalance();

    erc20 = await deployContract(deployer, "MockERC20", [
      "TestToken",
      "Test",
      18,
    ]);
    helper = await deployContract(deployer, "TestHelper", []);

    paymaster = await deployContract(deployer, "Paymaster", []);

    await fundAccount(whale, paymaster.address, "13");
    await (await erc20.mint(userWallet.address, 130)).wait();
    initialBalance_ERC20 = await erc20.balanceOf(userWallet.address);
  });

  async function executeTransaction(
    user: Wallet,
    token: Address,
    payType: "ApprovalBased" | "General"
  ) {
    console.log("start executeTransaction");

    const gasPrice = await provider.getGasPrice();
    const minimalAllowance = ethers.BigNumber.from(1);
    const expiration = (await helper.getTimestamp()).add(TX_EXPIRATION);

    const messageHash = await getMessageHash(
      user.address,
      token,
      minimalAllowance,
      expiration
    );

    const SignedMessageHash: any = signer.signMessage(messageHash);
    console.log("Message hash: ", messageHash.toString());
    console.log("User address: ", user.address.toString());
    console.log("ERC20 address: ", token.toString());
    console.log("Minimal allowance: ", minimalAllowance.toString());
    console.log("Expiration: ", expiration.toString());

    const paymasterParams = utils.getPaymasterParams(
      paymaster.address.toString(),
      {
        type: payType,
        token: token,
        minimalAllowance,
        innerInput: new Uint8Array(),
        SignedMessageHash,
      }
    );

    console.log("Paymaster params: ", paymasterParams);

    await (
      await erc20.connect(userWallet).mint(user.address, 5, {
        maxPriorityFeePerGas: ethers.BigNumber.from(0),
        maxFeePerGas: gasPrice,
        gasLimit: GAS_LIMIT,
        customData: {
          paymasterParams: paymasterParams,
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        },
      })
    ).wait();
  }

  // In solidity:
  // keccak256(abi.encodePacked())
  async function getMessageHash(
    _from: Address,
    _token: Address,
    _amount: ethers.BigNumber,
    _expiration: number
  ) {
    return ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["address", "address", "uint256", "uint256"],
        [_from, _token, _amount, _expiration]
      )
    );
  }

  it.only("Happy path: should validate and pay for paymaster transaction", async function () {
    await executeTransaction(
      userWallet,
      erc20.address,
      "ApprovalBased"
    );
    const newBalance = await userWallet.getBalance();
    const newBalance_ERC20 = await erc20.balanceOf(userWallet.address);
    expect(newBalance).to.be.eql(initialBalance);
    expect(newBalance_ERC20).to.be.eql(initialBalance_ERC20.add(4)); //5 minted - 1 fee
    console.log("Initial ERC20 balance: ", initialBalance_ERC20.toString());
    console.log("New ERC20 balance: ", newBalance_ERC20.toString());
    console.log(
      "ERC20 allowance: ",
      (await erc20.allowance(userWallet.address, paymaster.address)).toString()
    );
  });

  it("should revert if unsupported paymaster flow", async function () {
    await expect(
      executeTransaction(userWallet, erc20.address, "General")
    ).to.be.rejectedWith("Unsupported paymaster flow");
  });

  // it("should revert if invalid token is provided", async function () {
  //   const invalidTokenAddress = "0x000000000000000000000000000000000000dead";
  //   await expect(
  //     executeTransaction(userWallet, "ApprovalBased", invalidTokenAddress),
  //   ).to.be.rejectedWith("failed pre-paymaster preparation");
  // });

  it("should revert if allowance is too low", async function () {
    await fundAccount(whale, userWallet.address, "13");
    await erc20.approve(paymaster.address, ethers.BigNumber.from(0));
    try {
      await executeTransaction(
        userWallet,
        erc20.address,
        "ApprovalBased"
      );
    } catch (e) {
      expect(e.message).to.include("Min allowance too low");
    }
  });
});
