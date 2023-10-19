import axios from "axios";
import { expect, use } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, BigNumber } from "ethers";
import "@matterlabs/hardhat-zksync-chai-matchers";

import { deployContract, fundAccount, getTimestamp } from "./testHelpers";
import { Address } from "zksync-web3/build/src/types";

import dotenv from "dotenv";
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
  let user: Wallet;
  let verifier: Wallet;
  let initialBalance: BigNumber;
  let initialBalance_ERC20: BigNumber;
  let paymaster: Contract;
  let erc20: Contract;
  let helper: Contract;

  before(async function () {
    provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    whale = new Wallet(Whale, provider);
    admin = Wallet.createRandom();
    admin = new Wallet(admin.privateKey, provider);
    console.log("Deployer PK: ", admin.privateKey);
    console.log("Deployer address: ", admin.address);
    deployer = new Deployer(hre, whale);
    verifier = new Wallet(Verifier_PK, provider);
    user = Wallet.createRandom();
    user = new Wallet(user.privateKey, provider);
    console.log("Admin address: ", admin.address);
    console.log("Verifier address: ", verifier.address);
    console.log("User address: ", user.address);
    initialBalance = await user.getBalance();

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
    await paymaster.transferOwnership(admin.address);
    // paymaster = await deployContract(deployer, "Paymaster", [verifier.address]);
    console.log("Paymaster address: ", paymaster.address);

    await fundAccount(whale, paymaster.address, "14");
    await fundAccount(whale, admin.address, "14");
    await (await erc20.mint(user.address, 130)).wait();
    initialBalance_ERC20 = await erc20.balanceOf(user.address);
  })
  
//   beforeEach(async () => {
//     // Take a snapshot before each test
//     snapshotId = await ethers.provider.send("evm_snapshot", []);
// });

// afterEach(async () => {
//     // Revert the chain back to the snapshot after each test
//     await ethers.provider.send("evm_revert", [snapshotId]);
// });


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

    const paymasterParams = utils.getPaymasterParams(
      paymaster.address.toString(),
      {
        type: payType,
        token: token,
        minimalAllowance,
        innerInput,
      }
    );

    await (
      await erc20.connect(user).mint(user.address, 5, {
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
    const ownerAddress = await paymaster.owner();
    expect(verifierAddress).to.be.eql(verifier.address);
    expect(ownerAddress).to.be.eql(admin.address);
  });

  it("Should validate and pay for paymaster transaction", async function () {
    await executeTransaction(user, erc20.address, "ApprovalBased");
    const newBalance = await user.getBalance();
    const newBalance_ERC20 = await erc20.balanceOf(user.address);
    expect(newBalance).to.be.eql(initialBalance);
    expect(newBalance_ERC20).to.be.eql(initialBalance_ERC20.add(4)); //5 minted - 1 fee
    expect(
      await erc20.allowance(user.address, paymaster.address)
    ).to.be.eql(BigNumber.from(0));
  });

  it("Should not validate a wrong signature", async function () {
    await expect(
      executeTransaction(user, erc20.address, "ApprovalBased", false)
    ).to.be.rejectedWith("Invalid signature");
  });

  it("should revert if unsupported paymaster flow", async function () {
    await expect(
      executeTransaction(user, erc20.address, "General")
    ).to.be.rejectedWith("Unsupported paymaster flow");
  });

  it("should revert if allowance is too low", async function () {
    await fundAccount(whale, user.address, "13");
    await erc20.approve(paymaster.address, BigNumber.from(0));
    try {
      await executeTransaction(user, erc20.address, "ApprovalBased");
    } catch (e) {
      expect(e.message).to.include("Min allowance too low");
    }
  });

  it("Succesfully change verifier", async function () {
    const newVerifier = Wallet.createRandom();
    await paymaster.connect(admin).setVerifier(newVerifier.address);
    expect(await paymaster.verifier()).to.be.eql(newVerifier.address);
  });

  it("Should fail when trying to change verifier from an unauthorized address", async function () {
    const newVerifier = Wallet.createRandom();
    await expect(
      paymaster.connect(user).setVerifier(newVerifier.address)
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });


  it("Should allow the owner to withdraw ERC20", async function() {
    await erc20.mint(paymaster.address, 100);
    const paymasterBalance = await erc20.balanceOf(paymaster.address);
 
    await (await paymaster.connect(admin).withdrawERC20(erc20.address)).wait();

    expect(await erc20.balanceOf(admin.address)).to.equal(paymasterBalance);
  });

  it("Should allow the owner to withdraw ETH", async function() {
    const paymasterBalance = await provider.getBalance(paymaster.address);
    const adminBalance = await provider.getBalance(admin.address);


    await (await paymaster.connect(admin).withdraw(admin.address)).wait();
    expect(await provider.getBalance(paymaster.address)).to.be.eql(BigNumber.from(0));
  });
  it("Should fail when trying to transfer ERC20 tokens from an unauthorized address", async function () {
    await expect(
      paymaster.connect(user).withdrawERC20(erc20.address)
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });

  it("Should fail to withdraw ETH if not owner", async function () {
    await expect(
      paymaster.connect(user).withdraw(user.address)
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });

  it.skip("Should successfully upgrade the contract", async function () {
    const newPaymaster = await deployer.loadArtifact('PaymasterUpgrade');
    await (await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, paymaster.address, newPaymaster,[ verifier.address], { initializer: "initialize" })).wait();

  });

});
