"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = __importDefault(require("hardhat"));
const ethers_1 = require("ethers");
const hardhat_network_helpers_1 = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = hardhat_1.default;
const abiCoder = ethers_1.AbiCoder.defaultAbiCoder();
const VERSION_SALT = ethers.id("MS_ESCROW_V1");
function computeTransferId(recipientHash, amount, expiry) {
    return ethers.keccak256(abiCoder.encode(["bytes32", "bytes32", "uint96", "uint40"], [VERSION_SALT, recipientHash, amount, expiry]));
}
const emptyPermit = {
    enabled: false,
    value: 0,
    deadline: 0,
    v: 0,
    r: ethers.ZeroHash,
    s: ethers.ZeroHash,
};
describe("SharedEscrow", () => {
    async function deployFixture() {
        const [admin, sender, recipient] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("MockUSDC");
        const token = await Token.deploy();
        const SharedEscrow = await ethers.getContractFactory("SharedEscrow");
        const escrow = await SharedEscrow.deploy(admin.address);
        const mintAmount = ethers.parseUnits("1000", 6);
        await token.connect(admin).mint(sender.address, mintAmount);
        return { escrow, token, admin, sender, recipient };
    }
    it("creates a transfer and updates locked balance", async () => {
        const { escrow, token, admin, sender } = await deployFixture();
        const amount = ethers.parseUnits("10", 6);
        const escrowAddress = await escrow.getAddress();
        const tokenAddress = await token.getAddress();
        await token.connect(sender).approve(escrowAddress, amount);
        const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("alice@example.com"));
        const expiry = (await hardhat_network_helpers_1.time.latest()) + 3600;
        const transferId = computeTransferId(recipientHash, amount, expiry);
        await (0, chai_1.expect)(escrow.connect(admin).createTransfer({
            transferId,
            token: tokenAddress,
            fundingWallet: sender.address,
            amount,
            recipientHash,
            expiry,
        }, emptyPermit))
            .to.emit(escrow, "TransferCreated")
            .withArgs(transferId, sender.address, recipientHash, tokenAddress, amount, expiry);
        const stored = await escrow.getTransfer(transferId);
        (0, chai_1.expect)(stored.amount).to.equal(amount);
        (0, chai_1.expect)(await escrow.lockedBalance(tokenAddress)).to.equal(amount);
    });
    it("claims a pending transfer", async () => {
        const { escrow, token, admin, sender, recipient } = await deployFixture();
        const amount = ethers.parseUnits("25", 6);
        const escrowAddress = await escrow.getAddress();
        const tokenAddress = await token.getAddress();
        await token.connect(sender).approve(escrowAddress, amount);
        const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("bob@example.com"));
        const expiry = (await hardhat_network_helpers_1.time.latest()) + 3600;
        const transferId = computeTransferId(recipientHash, amount, expiry);
        await escrow.connect(admin).createTransfer({ transferId, token: tokenAddress, fundingWallet: sender.address, amount, recipientHash, expiry }, emptyPermit);
        await (0, chai_1.expect)(escrow.connect(admin).claimTransfer(transferId, recipient.address, recipientHash))
            .to.emit(escrow, "TransferClaimed")
            .withArgs(transferId, recipient.address);
        (0, chai_1.expect)(await token.balanceOf(recipient.address)).to.equal(amount);
        const info = await escrow.getTransfer(transferId);
        (0, chai_1.expect)(info.status).to.equal(2); // Status.Claimed
    });
    it("refunds after expiry", async () => {
        const { escrow, token, admin, sender } = await deployFixture();
        const amount = ethers.parseUnits("5", 6);
        const escrowAddress = await escrow.getAddress();
        const tokenAddress = await token.getAddress();
        await token.connect(sender).approve(escrowAddress, amount);
        const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("carol@example.com"));
        const expiry = (await hardhat_network_helpers_1.time.latest()) + 10;
        const transferId = computeTransferId(recipientHash, amount, expiry);
        await escrow.connect(admin).createTransfer({ transferId, token: tokenAddress, fundingWallet: sender.address, amount, recipientHash, expiry }, emptyPermit);
        await hardhat_network_helpers_1.time.increaseTo(expiry + 1);
        const prevBalance = await token.balanceOf(sender.address);
        await (0, chai_1.expect)(escrow.connect(admin).refundTransfer(transferId, sender.address))
            .to.emit(escrow, "TransferRefunded")
            .withArgs(transferId, sender.address);
        const newBalance = await token.balanceOf(sender.address);
        (0, chai_1.expect)(newBalance).to.equal(prevBalance + amount);
        const info = await escrow.getTransfer(transferId);
        (0, chai_1.expect)(info.status).to.equal(3); // Refunded
    });
    it("prevents operations while paused", async () => {
        const { escrow, token, admin, sender } = await deployFixture();
        await escrow.connect(admin).pause();
        const amount = ethers.parseUnits("1", 6);
        const escrowAddress = await escrow.getAddress();
        const tokenAddress = await token.getAddress();
        await token.connect(sender).approve(escrowAddress, amount);
        const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("eve@example.com"));
        const expiry = (await hardhat_network_helpers_1.time.latest()) + 3600;
        const transferId = computeTransferId(recipientHash, amount, expiry);
        await (0, chai_1.expect)(escrow.connect(admin).createTransfer({ transferId, token: tokenAddress, fundingWallet: sender.address, amount, recipientHash, expiry }, emptyPermit)).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
});
