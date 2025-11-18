"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedEscrowDriver = void 0;
const cdp_sdk_1 = require("@coinbase/cdp-sdk");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const coinbase_server_1 = require("../../config/coinbase.server");
const { abi: SHARED_ESCROW_ABI } = require("../../../artifacts/contracts/SharedEscrow.sol/SharedEscrow.json");
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const UINT96_MAX = (1n << 96n) - 1n;
const UINT40_MAX = (1n << 40n) - 1n;
const NETWORK_CHAIN_MAP = {
    base: chains_1.base,
    "base-sepolia": chains_1.baseSepolia,
};
class SharedEscrowDriver {
    constructor() {
        this.cdp = new cdp_sdk_1.CdpClient();
        this.network = process.env.ESCROW_NETWORK || "base-sepolia";
        this.chain = NETWORK_CHAIN_MAP[this.network];
        this.paymasterUrl = process.env.PAYMASTER_URL || coinbase_server_1.PAYMASTER_API_URL;
        this.contractAddress = process.env.ESCROW_CONTRACT_ADDRESS ?? (() => {
            throw new Error("ESCROW_CONTRACT_ADDRESS env var is required");
        })();
        this.tokenAddress = process.env.ESCROW_TOKEN_ADDRESS || coinbase_server_1.USDC_TOKEN_ADDRESS;
        this.fundingWallet = process.env.ESCROW_TREASURY_WALLET ?? (() => {
            throw new Error("ESCROW_TREASURY_WALLET env var is required");
        })();
        this.expirySeconds = Number(process.env.ESCROW_EXPIRY_SECONDS ?? 7 * 24 * 60 * 60);
        this.backendAccountName = process.env.CDP_BACKEND_ACCOUNT_NAME || "metasend-backend";
        this.backendSmartAccountName = process.env.CDP_BACKEND_SMART_ACCOUNT_NAME || "metasend-escrow";
        const salt = process.env.ESCROW_SALT_VERSION || "MS_ESCROW_V1";
        this.saltBytes32 = (0, viem_1.keccak256)((0, viem_1.stringToBytes)(salt));
        const rpcUrl = process.env.ESCROW_RPC_URL || this.chain.rpcUrls.default.http[0];
        this.publicClient = (0, viem_1.createPublicClient)({ chain: this.chain, transport: (0, viem_1.http)(rpcUrl) });
    }
    async createTransfer(input) {
        const smartAccount = await this.getSmartAccount();
        const normalizedEmail = input.recipientEmail.trim().toLowerCase();
        const recipientHash = this.computeRecipientHash(normalizedEmail);
        const amountAtomic = (0, viem_1.parseUnits)(input.amount, input.decimals);
        if (amountAtomic <= 0n) {
            throw new Error("Amount must be greater than zero");
        }
        if (amountAtomic > UINT96_MAX) {
            throw new Error("Amount exceeds uint96 range");
        }
        const expiry = input.expiry ?? Math.floor(Date.now() / 1000 + this.expirySeconds);
        if (expiry > Number(UINT40_MAX)) {
            throw new Error("Expiry exceeds uint40 range");
        }
        const transferId = this.computeTransferId(recipientHash, amountAtomic, expiry);
        const createCalls = [
            {
                to: this.contractAddress,
                value: 0n,
                abi: SHARED_ESCROW_ABI,
                functionName: "createTransfer",
                args: [
                    {
                        transferId,
                        token: input.tokenAddress ?? this.tokenAddress,
                        fundingWallet: input.fundingWallet ?? this.fundingWallet,
                        amount: amountAtomic,
                        recipientHash,
                        expiry,
                    },
                    {
                        enabled: false,
                        value: 0n,
                        deadline: 0,
                        v: 0,
                        r: ZERO_HASH,
                        s: ZERO_HASH,
                    },
                ],
            },
        ];
        const userOp = await this.cdp.evm.prepareAndSendUserOperation({
            smartAccount: smartAccount,
            network: this.network,
            paymasterUrl: this.paymasterUrl,
            calls: createCalls,
        });
        return {
            transferId,
            recipientHash,
            expiry,
            userOpHash: userOp.userOpHash,
        };
    }
    async claimTransfer(transferId, recipientAddress, recipientEmail) {
        const smartAccount = await this.getSmartAccount();
        const recipientHash = this.computeRecipientHash(recipientEmail.trim().toLowerCase());
        const claimCalls = [
            {
                to: this.contractAddress,
                value: 0n,
                abi: SHARED_ESCROW_ABI,
                functionName: "claimTransfer",
                args: [transferId, recipientAddress, recipientHash],
            },
        ];
        const userOp = await this.cdp.evm.prepareAndSendUserOperation({
            smartAccount: smartAccount,
            network: this.network,
            paymasterUrl: this.paymasterUrl,
            calls: claimCalls,
        });
        return { transferId, userOpHash: userOp.userOpHash };
    }
    async refundTransfer(transferId, refundAddress) {
        const smartAccount = await this.getSmartAccount();
        const refundCalls = [
            {
                to: this.contractAddress,
                value: 0n,
                abi: SHARED_ESCROW_ABI,
                functionName: "refundTransfer",
                args: [transferId, refundAddress],
            },
        ];
        const userOp = await this.cdp.evm.prepareAndSendUserOperation({
            smartAccount: smartAccount,
            network: this.network,
            paymasterUrl: this.paymasterUrl,
            calls: refundCalls,
        });
        return { transferId, userOpHash: userOp.userOpHash };
    }
    async loadOnchainTransfer(transferId) {
        try {
            const result = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: SHARED_ESCROW_ABI,
                functionName: "getTransfer",
                args: [transferId],
            });
            const normalized = result;
            if (normalized.sender === viem_1.zeroAddress && normalized.amount === 0n) {
                return null;
            }
            return {
                sender: normalized.sender,
                token: normalized.token,
                amount: normalized.amount,
                recipientHash: normalized.recipientHash,
                expiry: Number(normalized.expiry),
                status: normalized.status,
            };
        }
        catch (error) {
            console.error("Failed to read transfer", error);
            return null;
        }
    }
    computeRecipientHash(email) {
        return (0, viem_1.keccak256)((0, viem_1.encodeAbiParameters)([
            { type: "bytes32" },
            { type: "string" },
        ], [this.saltBytes32, email]));
    }
    computeTransferId(recipientHash, amount, expiry) {
        return (0, viem_1.keccak256)((0, viem_1.encodeAbiParameters)([
            { type: "bytes32" },
            { type: "bytes32" },
            { type: "uint96" },
            { type: "uint40" },
        ], [this.saltBytes32, recipientHash, amount, expiry]));
    }
    async getSmartAccount() {
        if (!this.smartAccountPromise) {
            this.smartAccountPromise = this.resolveSmartAccount();
        }
        return this.smartAccountPromise;
    }
    async resolveSmartAccount() {
        const owner = await this.cdp.evm.getOrCreateAccount({ name: this.backendAccountName });
        return this.cdp.evm.getOrCreateSmartAccount({ name: this.backendSmartAccountName, owner });
    }
}
exports.sharedEscrowDriver = new SharedEscrowDriver();
