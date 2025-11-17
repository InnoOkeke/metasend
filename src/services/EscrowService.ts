/**
 * Escrow Service
 * Handles creation and management of temporary escrow wallets for pending transfers
 */

import { ChainType } from "../types/database";
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL, USDC_TOKEN_ADDRESS, USDC_DECIMALS } from "../config/coinbase";

declare const require: any;

const isReactNative = typeof navigator !== "undefined" && navigator.product === "ReactNative";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (isReactNative) {
  try {
    SecureStore = require("expo-secure-store");
  } catch (error) {
    console.warn("⚠️ SecureStore unavailable, falling back to in-memory key storage");
    SecureStore = null;
  }
}

export type EscrowWallet = {
  address: string;
  privateKeyEncrypted: string;
  chain: ChainType;
};

export type EscrowTransferParams = {
  fromAddress: string;
  amount: string;
  tokenAddress: string;
  chain: ChainType;
};

type ExpoExtra = {
  escrowMasterKey?: string;
};

class EscrowService {
  private readonly ENCRYPTION_KEY_STORAGE = "metasend.escrow.master.key";
  private readonly IS_MOCK_MODE = false; // Real blockchain transfers enabled!
  private readonly extra = (() => {
    if (!isReactNative) {
      return {} as ExpoExtra;
    }
    try {
      const Constants = require("expo-constants").default;
      return (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;
    } catch (_error) {
      return {} as ExpoExtra;
    }
  })();
  private inMemoryMasterKey: string | null = null;

  /**
   * Generate a new escrow wallet for holding pending transfer funds
   */
  async generateEscrowWallet(chain: ChainType): Promise<EscrowWallet> {
    console.log(`[EscrowService] Generating new escrow wallet for chain: ${chain}`);

    if (chain === "evm") {
      // Generate random private key (32 bytes)
      const randomBytes = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        // Fallback for environments without crypto.getRandomValues
        for (let i = 0; i < 32; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      
      const privateKey = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      console.log(`[EscrowService] Generated EVM wallet: ${address}`);

      const encrypted = await this.encryptPrivateKey(privateKey);

      return {
        address,
        privateKeyEncrypted: encrypted,
        chain,
      };
    }

    // TODO: Implement Solana and Tron wallet generation
    throw new Error(`Chain ${chain} not yet implemented for real transfers`);
  }

  /**
   * Transfer funds from sender to escrow wallet
   * NOTE: This requires the sender to approve and sign the transaction from their wallet
   * In a real implementation, this would be called from the frontend after user approval
   */
  async depositToEscrow(params: EscrowTransferParams): Promise<string> {
    console.log(`[EscrowService] Depositing to escrow:`, params);

    if (params.chain === "evm") {
      // For now, return a placeholder since the actual deposit happens
      // when the user signs the transaction in their wallet (Coinbase Smart Wallet)
      // The frontend handles the actual transfer through CDP SDK
      console.log(`[EscrowService] ⚠️ Deposit should be handled by sender's wallet in frontend`);
      console.log(`[EscrowService] Sender needs to transfer ${params.amount} USDC to escrow`);
      
      // Return a mock hash - in production, this would be the actual tx hash from the wallet
      return `0xDEPOSIT_${Date.now()}_PENDING`;
    }

    throw new Error(`Chain ${params.chain} not yet implemented for deposits`);
  }

  /**
   * Transfer funds from escrow to recipient (when claimed)
   */
  async transferFromEscrow(
    escrowAddress: string,
    privateKeyEncrypted: string,
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    chain: ChainType
  ): Promise<string> {
    console.log("[EscrowService] transferFromEscrow called:", {
      from: escrowAddress,
      to: recipientAddress,
      amount,
      token: tokenAddress,
      chain,
      mockMode: this.IS_MOCK_MODE,
    });

    if (this.IS_MOCK_MODE) {
      console.warn("⚠️ [EscrowService] Running in MOCK MODE - No real blockchain transfer occurring!");
      await this.delay(1000);
      const txHash = `0xMOCK${Math.random().toString(36).substring(2).padEnd(60, "0")}`;
      console.log("[EscrowService] Mock transfer completed:", txHash);
      return txHash;
    }

    if (chain === "evm") {
      console.log("[EscrowService] 🚀 Executing REAL blockchain transfer on Base Sepolia");

      // 1. Decrypt private key
      const privateKey = await this.decryptPrivateKey(privateKeyEncrypted) as `0x${string}`;
      const account = privateKeyToAccount(privateKey);

      // 2. Create clients
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(BASE_RPC_URL),
      });

      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(BASE_RPC_URL),
      });

      // 3. Convert amount to proper units (USDC has 6 decimals)
      const amountInUnits = parseUnits(amount, USDC_DECIMALS);
      console.log(`[EscrowService] Transferring ${amount} USDC (${amountInUnits} units)`);

      // 4. ERC-20 Transfer ABI
      const transferAbi = [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ type: 'bool' }]
        }
      ] as const;

      // 5. Send transaction
      const txHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: transferAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInUnits],
      });

      console.log(`[EscrowService] ✅ Transaction sent: ${txHash}`);

      // 6. Wait for confirmation
      console.log(`[EscrowService] ⏳ Waiting for transaction confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      if (receipt.status === 'success') {
        console.log(`[EscrowService] ✅ Transaction confirmed in block ${receipt.blockNumber}`);
      } else {
        throw new Error(`Transaction failed: ${txHash}`);
      }

      return txHash;
    }

    throw new Error(`Chain ${chain} not yet implemented for real transfers`);
  }

  /**
   * Return funds from escrow to original sender (when expired/cancelled)
   */
  async returnFromEscrow(
    escrowAddress: string,
    privateKeyEncrypted: string,
    senderAddress: string,
    amount: string,
    tokenAddress: string,
    chain: ChainType
  ): Promise<string> {
    console.log("[EscrowService] Returning from escrow to sender:", {
      from: escrowAddress,
      to: senderAddress,
      amount,
      token: tokenAddress,
      chain,
    });

    // Use the same logic as transferFromEscrow, just to a different recipient
    return this.transferFromEscrow(
      escrowAddress,
      privateKeyEncrypted,
      senderAddress,
      amount,
      tokenAddress,
      chain
    );
  }

  /**
   * Check balance of escrow wallet
   */
  async getEscrowBalance(escrowAddress: string, tokenAddress: string, chain: ChainType): Promise<string> {
    if (this.IS_MOCK_MODE) {
      await this.delay(200);
      return "0";
    }

    if (chain === "evm") {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(BASE_RPC_URL),
      });

      const balanceOfAbi = [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }]
        }
      ] as const;

      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: balanceOfAbi,
        functionName: 'balanceOf',
        args: [escrowAddress as `0x${string}`],
      });

      return formatUnits(balance, USDC_DECIMALS);
    }

    return "0";
  }

  /**
   * Encrypt private key for storage
   */
  private async encryptPrivateKey(privateKey: string): Promise<string> {
    // In production: Use proper encryption
    // - expo-crypto for mobile
    // - Or backend KMS (AWS KMS, Google Cloud KMS)
    // - AES-256-GCM encryption

    const masterKey = await this.getMasterKey();
    const encrypted = Buffer.from(`${masterKey}:${privateKey}`).toString("base64");
    return encrypted;
  }

  /**
   * Decrypt private key for use
   */
  private async decryptPrivateKey(encrypted: string): Promise<string> {
    // In production: Use proper decryption matching encryption
    const masterKey = await this.getMasterKey();
    const decrypted = Buffer.from(encrypted, "base64").toString("utf-8");
    const [key, privateKey] = decrypted.split(":");

    if (key !== masterKey) {
      throw new Error("Invalid master key");
    }

    return privateKey;
  }

  /**
   * Get or create master encryption key
   * Priority: 1) Environment variable, 2) Secure storage, 3) Generate new
   */
  private async getMasterKey(): Promise<string> {
    // Check environment variable first (for production)
    if (this.extra.escrowMasterKey) {
      return this.extra.escrowMasterKey;
    }

    if (process.env.ESCROW_MASTER_KEY) {
      return process.env.ESCROW_MASTER_KEY;
    }

    if (SecureStore) {
      let key = await SecureStore.getItemAsync(this.ENCRYPTION_KEY_STORAGE);

      if (!key) {
        key = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await SecureStore.setItemAsync(this.ENCRYPTION_KEY_STORAGE, key);
        console.warn("⚠️  Generated new escrow master key. For production, set ESCROW_MASTER_KEY in .env");
      }

      return key;
    }

    if (!this.inMemoryMasterKey) {
      this.inMemoryMasterKey = Math.random().toString(36).substring(2) + Date.now().toString(36);
      console.warn("⚠️ Using in-memory escrow master key. Set ESCROW_MASTER_KEY for persistence.");
    }

    return this.inMemoryMasterKey;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const escrowService = new EscrowService();
