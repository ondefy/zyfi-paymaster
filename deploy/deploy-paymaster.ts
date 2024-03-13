import { Contract, Provider, Wallet, utils } from "zksync-ethers";
import { Address } from "zksync-ethers/build/src/types";
import { deployContract, fundAccount, getWallet } from "./prodUtils";

export default async function () {
  const verifierAddress: Address = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";
  const AdminAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";

  const paymaster = await deployContract(
    "ERC20SponsorPaymaster",
    [verifierAddress],
    {
      transferOwnership: AdminAddress,
    }
  );

  const vault = await deployContract("SponsorshipVault", [paymaster.address]);
  // const provider: Wallet = getWallet();
  // console.log("Provider balance: ", (await provider.getBalance()).toString());
  // await fundAccount(
  //   provider,
  //   "0xEcacba301285cE4308aAFc71319F9a670fdd1C7a",
  //   "0.10"
  // );
}
