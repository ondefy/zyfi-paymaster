import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { Contract, Wallet, utils } from "zksync-ethers";

import { Address } from "zksync-ethers/build/src/types";
import {
  deployContract,
  fundAccount,
  getProvider,
  getWallet,
} from "../../deploy/prodUtils";
import { LOCAL_RICH_WALLETS, getMessageHash, mockRatio } from "../testUtils";

// public address = "0x4826ed1D076f150eF2543F72160c23C7B519659a";
const Verifier_PK =
  "0x8f6e509395c13960f501bc7083450ffd0948bc94103433d5843e5060a91756da";

const GAS_LIMIT = 4_000_000;
const TX_EXPIRATION = 30 * 60; //30 minute

describe("ERC20Paymaster", () => {
  const provider = getProvider();
  let admin: Wallet;
  let whale: Wallet;
  let user: Wallet;
  let verifier: Wallet;
  let initialBalance: BigNumber;
  let initialBalance_ERC20: BigNumber;
  let paymaster: Contract;
  let erc20: Contract;
  let helper: Contract;

  type executeTransactionOptions = {
    // If true, indicates that a wrong signature should be generated
    wrongSignature?: boolean;
    // If true, indicates that the transaction should be expired
    expiredtx?: boolean;
  };

  async function executeTransaction(
    user: Wallet,
    token: Address,
    payType: "ApprovalBased" | "General",
    options?: executeTransactionOptions
  ) {
    const gasPrice = await provider.getGasPrice();
    const ratio = mockRatio();

    // const minimalAllowance = ethers.utils.parseEther("1");
    const minimalAllowance = BigNumber.from(GAS_LIMIT)
      .mul(gasPrice)
      .mul(ratio)
      .div(1e8);
    // console.log("minimalAllowance", minimalAllowance.toString());

    const currentTimestamp = await helper.getTimestamp();

    let expiration: BigNumber;

    // Check if the transaction is intended to be expired
    if (options?.expiredtx) {
      expiration = BigNumber.from(currentTimestamp.sub(1));
    } else {
      expiration = BigNumber.from(currentTimestamp.add(TX_EXPIRATION));
    }

    let allowance: BigNumber;
    // Check if a wrong signature is intended
    if (options?.wrongSignature) {
      allowance = minimalAllowance.add(1);
    } else {
      allowance = minimalAllowance;
    }

    const messageHash = await getMessageHash(
      user.address,
      token,
      token,
      allowance,
      expiration,
      gasPrice,
      BigNumber.from(GAS_LIMIT)
    );

    const SignedMessageHash = await verifier.signMessage(
      ethers.utils.arrayify(messageHash)
    );

    const innerInput = ethers.utils.defaultAbiCoder.encode(
      ["uint64", "bytes"],
      [expiration, ethers.utils.arrayify(SignedMessageHash)]
    );

    const paymasterParams = utils.getPaymasterParams(
      paymaster.address.toString(),
      {
        type: payType,
        token: token,
        minimalAllowance,
        innerInput,
      }
    );

    // console.log("paymasterParams", paymasterParams);
    //  verify gas

    // Cannot estimate gas with a wrong signature
    if (!options?.wrongSignature) {
      const gasLimit = await erc20
        .connect(user)
        .estimateGas.mint(user.address, 5, {
          maxPriorityFeePerGas: BigNumber.from(0),
          maxFeePerGas: gasPrice,
          customData: {
            paymasterParams: paymasterParams,
            gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
          },
        });
      console.log(
        "gasLimit",
        gasLimit.toString(),
        "wrong signature:",
        options?.wrongSignature
      );
    }

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
  before(async () => {
    whale = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    admin = getWallet(LOCAL_RICH_WALLETS[1].privateKey);
    verifier = getWallet(LOCAL_RICH_WALLETS[2].privateKey);
    user = getWallet(LOCAL_RICH_WALLETS[3].privateKey);

    const newwallet = Wallet.createRandom();
    // console.log("newwallet", newwallet.address);
    // console.log("newwallet", newwallet.privateKey);

    initialBalance = await user.getBalance();
    erc20 = await deployContract("MockERC20", ["TestToken", "Test", 18], {
      silent: true,
    });
    helper = await deployContract("TestHelper", [], {
      silent: true,
    });

    paymaster = await deployContract("ERC20Paymaster", [verifier.address], {
      proxy: false,
      silent: false,
    });
    await paymaster.transferOwnership(admin.address);

    await fundAccount(whale, paymaster.address, "14");
    await fundAccount(whale, admin.address, "14");
    await (
      await erc20.mint(user.address, ethers.utils.parseEther("100"))
    ).wait();
    initialBalance_ERC20 = await erc20.balanceOf(user.address);
  });

  //   beforeEach(async () => {
  //     // Take a snapshot before each test
  //     snapshotId = await ethers.provider.send("evm_snapshot", []);
  // });

  // afterEach(async () => {
  //     // Revert the chain back to the snapshot after each test
  //     await ethers.provider.send("evm_revert", [snapshotId]);
  // });
  describe("V1 features", () => {
    it("Initial parameters are correctly set", async () => {
      const verifierAddress = await paymaster.verifier();
      expect(verifierAddress).to.be.eql(verifier.address);
      const ownerAddress = await paymaster.owner();
      expect(ownerAddress).to.be.eql(admin.address);
    });

    it("Should validate and pay for paymaster transaction", async () => {
      await executeTransaction(user, erc20.address, "ApprovalBased");
      const newBalance = await user.getBalance();
      const newBalance_ERC20 = await erc20.balanceOf(user.address);
      // TODO
      expect(newBalance).to.be.eql(initialBalance);
      // expect(newBalance_ERC20).to.be.eql(initialBalance_ERC20.add(4)); //5 minted - 1 fee
      expect(await erc20.allowance(user.address, paymaster.address)).to.be.eql(
        BigNumber.from(0)
      );
    });

    it("Should not validate a wrong signature", async () => {
      await expect(
        executeTransaction(user, erc20.address, "ApprovalBased", {
          wrongSignature: true,
        })
      ).to.be.rejectedWith(
        "Paymaster validation returned invalid magic value."
      );
    });

    it("should revert if unsupported paymaster flow", async () => {
      await expect(
        executeTransaction(user, erc20.address, "General", {})
      ).to.be.rejectedWith("0xff15b069");
    });

    it("should revert if allowance is too low", async () => {
      await fundAccount(whale, user.address, "13");
      await erc20.approve(paymaster.address, BigNumber.from(0));
      try {
        await executeTransaction(user, erc20.address, "ApprovalBased");
      } catch (e) {
        expect(e.message).to.include("Errors.AllowanceTooLow");
      }
    });

    it("Successfully change verifier", async () => {
      const newVerifier = Wallet.createRandom();
      await paymaster.connect(admin).setVerifier(newVerifier.address);
      expect(await paymaster.verifier()).to.be.eql(newVerifier.address);
    });

    it("Should fail when trying to change verifier from an unauthorized address", async () => {
      const newVerifier = Wallet.createRandom();
      await expect(
        paymaster.connect(user).setVerifier(newVerifier.address)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should allow the owner to withdraw ETH", async () => {
      const paymasterBalance = await provider.getBalance(paymaster.address);
      const withdrawAmount = BigNumber.from(10);
      const adminBalance = await provider.getBalance(admin.address);

      await (
        await paymaster
          .connect(admin)
          .withdrawETH(admin.address, withdrawAmount)
      ).wait();
      expect(await provider.getBalance(paymaster.address)).to.be.eql(
        paymasterBalance.sub(withdrawAmount)
      );
    });

    it("Should fail to withdraw ETH if not owner", async () => {
      await expect(
        paymaster.connect(user).withdrawETH(user.address, BigNumber.from(10))
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });
    it("Should allow the owner to withdraw ERC20", async () => {
      await erc20.mint(paymaster.address, 100);
      const paymasterBalance = await erc20.balanceOf(paymaster.address);

      await (
        await paymaster
          .connect(admin)
          .withdrawERC20(admin.address, erc20.address, paymasterBalance)
      ).wait();

      expect(await erc20.balanceOf(admin.address)).to.equal(paymasterBalance);
    });
    it("Should fail when trying to transfer ERC20 tokens from an unauthorized address", async () => {
      await expect(
        paymaster
          .connect(user)
          .withdrawERC20(user.address, erc20.address, BigNumber.from(10))
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    it("Should allow the owner to batch withdraw ERC20", async () => {
      await erc20.mint(paymaster.address, 100);
      const paymasterBalance = await erc20.balanceOf(paymaster.address);
      const adminBalance = await erc20.balanceOf(admin.address);

      await (
        await paymaster
          .connect(admin)
          .withdrawERC20Batch(
            admin.address,
            [erc20.address],
            [paymasterBalance]
          )
      ).wait();

      expect(await erc20.balanceOf(admin.address)).to.equal(
        adminBalance.add(paymasterBalance)
      );
    });
    it("Should fail when trying to batch transfer ERC20 tokens from an unauthorized address", async () => {
      await expect(
        paymaster
          .connect(user)
          .withdrawERC20Batch(
            user.address,
            [erc20.address],
            [BigNumber.from(10)]
          )
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });

    // it.skip("Should successfully upgrade the contract", async () => {
    // 	const newPaymaster = await deployer.loadArtifact("PaymasterUpgrade");
    // 	await (
    // 		await hre.zkUpgrades.upgradeProxy(
    // 			deployer.zkWallet,
    // 			paymaster.address,
    // 			newPaymaster,
    // 			{ verifier: verifier.address },
    // 			{
    // 				initializer: "initialize",
    // 			},
    // 		)
    // 	).wait();
    // });
  });
  describe("V2 features", () => {
    it("Should fail if the tx is expired", async () => {
      await expect(
        executeTransaction(user, erc20.address, "ApprovalBased", {
          expiredtx: true,
        })
      ).to.be.rejectedWith("0xe397952c"); //tx expired
    });
  });
  describe("Cantina audit", () => {
    it("Should not renounce ownership", async () => {
      await paymaster.connect(admin).renounceOwnership();
      expect(await paymaster.owner()).to.be.eql(admin.address);
    });
  });
});
