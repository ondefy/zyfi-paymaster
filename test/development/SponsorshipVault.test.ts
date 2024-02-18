import { assert, expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { Contract, Wallet, utils } from "zksync-ethers";

import { Address } from "zksync-ethers/build/src/types";
import { deployContract, getProvider, getWallet } from "../../deploy/prodUtils";
import { LOCAL_RICH_WALLETS } from "../testUtils";

describe.skip("SponsorshipVault", () => {
  let vault: Contract;
  let paymaster: Contract;
  let verifier: Wallet;
  let user1: Wallet;
  let user2: Wallet;
  const provider = getProvider();
  const amount = ethers.utils.parseEther("1");

  before(async () => {
    user1 = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    user2 = getWallet(LOCAL_RICH_WALLETS[1].privateKey);
    verifier = getWallet(LOCAL_RICH_WALLETS[2].privateKey);
    erc20.address;
    paymaster = await deployContract("Paymaster", [verifier.address], {
      proxy: true,
      silent: true,
    });

    vault = await deployContract("SponsorshipVault", [paymaster.address], {
      silent: true,
    });
  });

  describe("Deployment", () => {
    it("Should set the right paymaster", async () => {
      expect(await vault.paymaster()).to.equal(paymaster.address);
    });
  });

  describe("Deposits", () => {
    it("Should accept deposits and update balances", async () => {
      const initialBalance = await provider.getBalance(user1.address);

      await user1.sendTransaction({
        to: vault.address,
        value: amount,
      });

      const finalBalance = await provider.getBalance(user1.address);
      const expectedBalance = initialBalance.sub(amount);

      // expect(finalBalance).to.equal(expectedBalance);
      expect(await vault.balances(user1.address)).to.equal(amount);
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
      const balance = await provider.getBalance(user1.address);
      await expect(
        vault.connect(user1).withdraw(balance.add(amount))
      ).to.be.rejectedWith("Insufficient balance");
    });

    it("Should not allow other users to use getSponsorship", async () => {
      await expect(
        vault.connect(user1).getSponsorship(user2.address, amount)
      ).to.be.rejectedWith("Only paymaster can withdraw");
    });
  });

  // Additional tests can be added for edge cases and other functionalities
});
