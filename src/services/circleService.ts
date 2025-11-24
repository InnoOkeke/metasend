import { CIRCLE_API_KEY, CIRCLE_API_URL } from '../config/circle';
import type { Address, Hex } from 'viem';

export type CircleWallet = {
    id: string;
    address: string;
    blockchain: string;
    accountType: 'EOA' | 'SCA';
    state: 'LIVE' | 'FROZEN';
    createDate: string;
};

export type CircleTransaction = {
    id: string;
    blockchain: string;
    tokenId: string;
    walletId: string;
    sourceAddress: string;
    destinationAddress: string;
    transactionType: string;
    custodyType: string;
    state: string;
    amounts: string[];
    nfts: any[];
    txHash?: string;
    blockHash?: string;
    blockHeight?: number;
    networkFee?: string;
    firstConfirmDate?: string;
    operation: string;
    userId: string;
    abiParameters: any;
    createDate: string;
    updateDate: string;
};

class CircleService {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = CIRCLE_API_KEY;
        this.baseUrl = CIRCLE_API_URL;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Circle API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.data as T;
    }

    /**
     * Create a developer-controlled wallet (smart contract account)
     * We'll use the EOA from Web3Auth as the signer
     */
    async createWallet(params: {
        idempotencyKey: string;
        accountType: 'SCA';
        blockchains: string[];
        metadata?: Array<{ key: string; value: string }>;
    }): Promise<CircleWallet> {
        return this.request<CircleWallet>('/developer/wallets', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * Get wallet by ID
     */
    async getWallet(walletId: string): Promise<CircleWallet> {
        return this.request<CircleWallet>(`/developer/wallets/${walletId}`);
    }

    /**
     * Sign and execute a transaction using Circle's Signing API
     * This will use the developer wallet and can leverage Gas Station for sponsorship
     */
    async signTransaction(params: {
        walletId: string;
        blockchain: string;
        transaction: {
            to: Address;
            data: Hex;
            value?: string;
        };
        fee?: {
            type: 'level' | 'custom';
            config: {
                feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
                maxFee?: string;
                priorityFee?: string;
                gasLimit?: string;
            };
        };
    }): Promise<CircleTransaction> {
        const { walletId, blockchain, transaction, fee } = params;

        // Construct the transaction payload for Circle
        const payload = {
            walletId,
            blockchain,
            callData: transaction.data,
            contractAddress: transaction.to,
            amounts: transaction.value ? [transaction.value] : ['0'],
            fee: fee || {
                type: 'level',
                config: {
                    feeLevel: 'MEDIUM',
                },
            },
        };

        return this.request<CircleTransaction>('/developer/transactions/transfer', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    /**
     * Get transaction status
     */
    async getTransaction(transactionId: string): Promise<CircleTransaction> {
        return this.request<CircleTransaction>(`/developer/transactions/${transactionId}`);
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(transactionId: string, maxAttempts = 60): Promise<string> {
        for (let i = 0; i < maxAttempts; i++) {
            const tx = await this.getTransaction(transactionId);

            if (tx.state === 'COMPLETE' && tx.txHash) {
                return tx.txHash;
            }

            if (tx.state === 'FAILED' || tx.state === 'DENIED') {
                throw new Error(`Transaction ${tx.state.toLowerCase()}`);
            }

            // Wait 2 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Transaction confirmation timeout');
    }
}

export const circleService = new CircleService();
