import { Contract, Provider, Wallet, utils } from "zksync-ethers";
import { Address } from "zksync-ethers/build/src/types";
import { deployContract, fundAccount, getWallet } from "./prodUtils";

export default async function () {
    // Mainnet
    // const verifierAddress: Address = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";

    // Testnet
    const verifierAddress: Address = "0xa5A40aBBb41Ecb9379fE4E19Fcbc1788B8bFdE59";

    require("dotenv").config();

    // const AdminAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";

    console.log(`Deploying ERC20 Paymaster...`);
    const paymaster = await deployContract("ERC20Paymaster", [verifierAddress]);
    console.log(`Deployed to ${paymaster.address}`);

    // Fund the paymaster
    await fundAccount(getWallet(), paymaster.address, "0.1");
    // await paymaster.transferOwnership(AdminAddress);
}
