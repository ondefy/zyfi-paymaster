import { assert, expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { Contract, Wallet, utils } from "zksync-ethers";

import { Address } from "zksync-ethers/build/src/types";
import { deployContract, getProvider, getWallet } from "../../deploy/prodUtils";
import { LOCAL_RICH_WALLETS } from "../testUtils";

const GAS_LIMIT = 10_000_000;

describe.only("SponsorshipVault", () => {
  let vault: Contract;
  let paymaster: Contract;
  let verifier: Wallet;
  let user1: Wallet;
  let user2: Wallet;
  let erc20: Contract;
  const provider = getProvider();
  const amount = ethers.utils.parseEther("1");

  before(async () => {
    user1 = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    user2 = getWallet(LOCAL_RICH_WALLETS[1].privateKey);
    verifier = getWallet(LOCAL_RICH_WALLETS[2].privateKey);
    erc20 = await deployContract("MockERC20", ["TestToken", "Test", 18], {
      silent: true,
    });
    paymaster = await deployContract(
      "ERC20SponsorPaymaster",
      [verifier.address],
      {
        silent: true,
      }
    );

    vault = await deployContract("SponsorshipVault", [paymaster.address], {
      silent: true,
    });
    await vault
      .connect(user1)
      .depositToAccount(user1.address, { value: amount });

    await vault
      .connect(user2)
      .depositToAccount(user2.address, { value: amount });
  });

  describe("Deployment", () => {
    it("Should set the right paymaster", async () => {
      const paymasterAddress = await vault.paymaster();
      expect(paymasterAddress).to.be.eql(paymaster.address);
    });
  });

  describe("Deposits", () => {
    it("Should accept deposits and update balances", async () => {
      const initialBalance = await provider.getBalance(user1.address);
      const initialVaultBalance = await vault.balances(user1.address);

      await user1.sendTransaction({
        to: vault.address,
        value: amount,
      });

      const finalBalance = await provider.getBalance(user1.address);
      const expectedBalance = initialBalance.sub(amount);

      // expect(finalBalance).to.equal(expectedBalance);
      expect(await vault.balances(user1.address)).to.equal(initialVaultBalance.add(amount));
    });
  });

  describe("Withdrawals", () => {
    it("Should allow users to withdraw their funds", async () => {
      await user1.sendTransaction({
        to: vault.address,
        value: amount,
      });
      const initialEth = await provider.getBalance(user1.address);
      const initialBalance = await vault.balances(user1.address);
      await vault.connect(user1).withdraw(amount);
      const finalEth = await provider.getBalance(user1.address);
      const finalBalance = await vault.balances(user1.address);
      expect(initialBalance.sub(amount)).to.equal(finalBalance);
      assert.isTrue(finalEth.gt(initialEth));
    });

    it("Should not allow users to withdraw more than their balance", async () => {
      let errorOccurred = false;
      const balance = await vault.balances(user1.address);
      console.log("balance", balance.toString());
      try {
        await vault
          .connect(user1)
          .withdraw(balance.add(amount), { gasLimit: GAS_LIMIT });
      } catch (error) {
        errorOccurred = true;
        console.log("error.message", error.message);
        expect(error.message).to.include(
          "Paymaster validation returned invalid magic value."
        );
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should not allow other users to use getSponsorship", async () => {
      await expect(
        vault
          .connect(user1)
          .getSponsorship(user2.address, amount, { gasLimit: GAS_LIMIT })
      ).to.be.rejectedWith("Only paymaster can withdraw");
    });
  });

  // Additional tests can be added for edge cases and other functionalities
});
