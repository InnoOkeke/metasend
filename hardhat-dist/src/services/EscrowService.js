"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escrowService = void 0;
const isReactNative = typeof navigator !== "undefined" && navigator.product === "ReactNative";
class EscrowService {
    constructor() {
        this.driverPromise = null;
        this.extra = this.loadExpoExtra();
        this.IS_MOCK_MODE = this.resolveMockMode();
    }
    async createOnchainTransfer(request) {
        if (request.chain !== "evm") {
            throw new Error(`Unsupported chain ${request.chain} for shared escrow`);
        }
        if (this.IS_MOCK_MODE) {
            return this.createMockTransfer(request);
        }
        const driver = await this.requireDriver();
        if (!driver) {
            throw new Error("Escrow driver unavailable in this environment");
        }
        const receipt = await driver.sharedEscrowDriver.createTransfer({
            recipientEmail: request.recipientEmail,
            amount: request.amount,
            decimals: request.decimals,
            tokenAddress: request.tokenAddress,
            expiry: request.expiry,
        });
        return {
            transferId: receipt.transferId,
            recipientHash: receipt.recipientHash,
            expiry: receipt.expiry,
            txHash: receipt.userOpHash,
        };
    }
    async claimOnchainTransfer(transferId, recipientAddress, recipientEmail) {
        if (this.IS_MOCK_MODE) {
            return {
                transferId,
                txHash: this.mockHash(),
            };
        }
        const driver = await this.requireDriver();
        if (!driver) {
            throw new Error("Escrow driver unavailable in this environment");
        }
        const receipt = await driver.sharedEscrowDriver.claimTransfer(transferId, recipientAddress, recipientEmail.toLowerCase());
        return {
            transferId,
            txHash: receipt.userOpHash,
        };
    }
    async refundOnchainTransfer(transferId, refundAddress) {
        if (this.IS_MOCK_MODE) {
            return {
                transferId,
                txHash: this.mockHash(),
            };
        }
        const driver = await this.requireDriver();
        if (!driver) {
            throw new Error("Escrow driver unavailable in this environment");
        }
        const receipt = await driver.sharedEscrowDriver.refundTransfer(transferId, refundAddress);
        return {
            transferId,
            txHash: receipt.userOpHash,
        };
    }
    async getOnchainTransfer(transferId) {
        if (this.IS_MOCK_MODE) {
            return null;
        }
        const driver = await this.requireDriver();
        if (!driver) {
            return null;
        }
        const state = await driver.sharedEscrowDriver.loadOnchainTransfer(transferId);
        if (!state) {
            return null;
        }
        return {
            sender: state.sender,
            token: state.token,
            amount: state.amount.toString(),
            recipientHash: state.recipientHash,
            expiry: state.expiry,
            status: state.status,
        };
    }
    isMockMode() {
        return this.IS_MOCK_MODE;
    }
    loadExpoExtra() {
        if (!isReactNative) {
            return {};
        }
        try {
            const Constants = require("expo-constants").default;
            return (Constants?.expoConfig?.extra ?? {});
        }
        catch (_error) {
            return {};
        }
    }
    resolveMockMode() {
        if (isReactNative) {
            return Boolean(this.extra?.escrowMockMode);
        }
        if (process.env.ESCROW_USE_MOCK) {
            return process.env.ESCROW_USE_MOCK !== "false";
        }
        return false;
    }
    async requireDriver() {
        if (isReactNative) {
            return null;
        }
        if (!this.driverPromise) {
            this.driverPromise = import("./server/SharedEscrowDriver");
        }
        return this.driverPromise;
    }
    createMockTransfer(request) {
        const transferId = this.mockHash();
        const recipientHash = this.mockHash();
        const expiry = request.expiry ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        return {
            transferId,
            recipientHash,
            expiry,
            txHash: this.mockHash(),
        };
    }
    mockHash() {
        return `0xmock${Math.random().toString(16).slice(2).padEnd(60, "0")}`.slice(0, 66);
    }
}
exports.escrowService = new EscrowService();
