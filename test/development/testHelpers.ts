import { Contract, Wallet } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, providers } from "ethers";

export async function deployContract(
  deployer: Deployer,
  contract: string,
  params: any[]
): Promise<Contract> {
  const artifact = await deployer.loadArtifact(contract);
  const deploymentFee = await deployer.estimateDeployFee(artifact, params);
  const parsedFee = ethers.utils.formatEther(deploymentFee.toString());

  return await deployer.deploy(artifact, params);
}

export async function fundAccount(
  wallet: Wallet,
  address: string,
  amount: string
) {
  await (
    await wallet.sendTransaction({
      to: address,
      value: ethers.utils.parseEther(amount),
    })
  ).wait();
}

export async function getTimestamp(provider: providers.JsonRpcProvider) {

  return block.timestamp;
}
