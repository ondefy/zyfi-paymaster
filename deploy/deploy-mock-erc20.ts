import { deployContract } from "./prodUtils";

export default async function () {
    console.log(`Deploying Mock ERC20...`);
    const contract = await deployContract("MockERC20", ["Mock", "Mock", 18]);
    console.log(`Deployed to ${await contract.getAddress()}`);
}
