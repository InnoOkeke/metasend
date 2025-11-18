"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
async function main() {
    const [deployer] = await hardhat_1.ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    const factory = await hardhat_1.ethers.getContractFactory("SharedEscrow");
    const admin = process.env.ESCROW_ADMIN_ADDRESS || deployer.address;
    const contract = await factory.deploy(admin);
    await contract.waitForDeployment();
    console.log("SharedEscrow deployed to:", await contract.getAddress());
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
