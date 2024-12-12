import { Contract, Provider, Wallet, utils } from "zksync-ethers";
import { deployContract, fundAccount, getWallet } from "./prodUtils";

export default async function () {
    // Mainnet
    const verifierAddress = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";

    // Testnet
    // const verifierAddress = "0xa5A40aBBb41Ecb9379fE4E19Fcbc1788B8bFdE59";

    // const AdminAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";

    require("dotenv").config();

    const paymaster = await deployContract("ERC20SponsorPaymaster", [verifierAddress]);

    const vault = await deployContract("SponsorshipVault", [await paymaster.getAddress()]);

    console.log("Setting vault in paymaster...");
    const tx = await paymaster.setVault(await vault.getAddress());
    console.log("Vault set in paymaster: ", tx.hash);

    // Fund the paymaster
    await fundAccount(getWallet(), await paymaster.getAddress(), "100");

    // await paymaster.transferOwnership(AdminAddress);
}
