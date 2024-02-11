import { Contract, Provider, Wallet, utils } from "zksync-ethers";
import { Address } from "zksync-ethers/build/src/types";
import { deployContract } from "./prodUtils";

export default async function () {
	const verifierAddress: Address = "0xe65D3C2A9C43985763515Dd92099a4c63B1e108C";
	const AdminAddress: Address = "0xeacA6dB0aEe62c87a69C3d6Bcf6BCcc9388b7565";

	await deployContract(
		"ZyfiPaymaster",
		[verifierAddress],
		{ transferOwnership: AdminAddress },
	);
}
