import { utils, Provider, Wallet, Contract} from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import dotenv from "dotenv";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider(process.env.RPC_ZKSYNC!);
  let paymaster: Contract;
  let deployer: Deployer;
  let adminAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";
  let verifierAddress: Address = "0xFb8257B797cA0f4d2c77279797D6ddaA027BEE00";

  // The wallet that will deploy the token and the paymaster
  // It is assumed that this wallet already has sufficient funds on zkSync
  const deployerWallet = new Wallet(process.env.DEPLOYER!, provider);
  deployer = new Deployer(hre, deployerWallet); 

  console.log("Deploying Paymaster...");
  const contract = await deployer.loadArtifact("Paymaster");
  paymaster = await hre.zkUpgrades.deployProxy(deployer.zkWallet, contract, [ verifierAddress], { initializer: "initialize" });
  await paymaster.deployed();
  console.log("Paymaster deployed to:", paymaster.address);
  await paymaster.transferOwnership(adminAddress);
  console.log("Paymaster ownership transferred to:", adminAddress);


  // console.log("Funding paymaster with ETH");
  // // Supplying paymaster with ETH

  // await (
  //   await deployer.zkWallet.sendTransaction({
  //     to: paymaster.address,
  //     value: ethers.utils.parseEther("0.06"),
  //   })
  // ).wait();

  let paymasterBalance = await provider.getBalance(paymaster.address);

  console.log(`Paymaster ETH balance is now ${paymasterBalance.toString()}`);

  // // Supplying the ERC20 tokens to the empty wallet:
  // await // We will give the empty wallet 3 units of the token:
  // (await erc20.mint(emptyWallet.address, 3)).wait();

  // console.log("Minted 3 tokens for the empty wallet");

  console.log(`Done!`);
}
