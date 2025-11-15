/**
 * Escrow Service
 * Handles creation and management of temporary escrow wallets for pending transfers
 */

import { ChainType } from "../types/database";

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
    // In production, use proper wallet generation libraries:
    // - ethers.js Wallet.createRandom() for EVM
    // - @solana/web3.js Keypair.generate() for Solana
    // - TronWeb for Tron

    await this.delay(300);

    const randomId = Math.random().toString(36).substring(7);
    let address: string;

    switch (chain) {
      case "evm":
        address = `0x${randomId.padEnd(40, "0")}`;
        break;
      case "solana":
        address = `${randomId.padEnd(44, "0")}`;
        break;
      case "tron":
        address = `T${randomId.padEnd(33, "0")}`;
        break;
    }

    const mockPrivateKey = `pk_${randomId}_${Date.now()}`;
    const encrypted = await this.encryptPrivateKey(mockPrivateKey);

    return {
      address,
      privateKeyEncrypted: encrypted,
      chain,
    };
  }

  /**
   * Transfer funds from sender to escrow wallet
   */
  async depositToEscrow(params: EscrowTransferParams): Promise<string> {
    // In production: Execute actual blockchain transaction
    // - For EVM: Use ethers.js or viem to send transaction
    // - For Solana: Use @solana/web3.js
    // - For Tron: Use TronWeb

    await this.delay(800);

    const txHash = `0x${Math.random().toString(36).substring(2).padEnd(64, "0")}`;
    return txHash;
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
    // In production:
    // 1. Decrypt private key
    // 2. Create transaction from escrow to recipient
    // 3. Sign with escrow private key
    // 4. Broadcast transaction

    await this.delay(1000);

    const privateKey = await this.decryptPrivateKey(privateKeyEncrypted);
    console.log("Transferring from escrow:", {
      from: escrowAddress,
      to: recipientAddress,
      amount,
      token: tokenAddress,
      chain,
    });

    const txHash = `0x${Math.random().toString(36).substring(2).padEnd(64, "0")}`;
    return txHash;
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
    // Same as transferFromEscrow but to sender
    await this.delay(1000);

    const privateKey = await this.decryptPrivateKey(privateKeyEncrypted);
    console.log("Returning from escrow to sender:", {
      from: escrowAddress,
      to: senderAddress,
      amount,
      token: tokenAddress,
      chain,
    });

    const txHash = `0x${Math.random().toString(36).substring(2).padEnd(64, "0")}`;
    return txHash;
  }

  /**
   * Check balance of escrow wallet
   */
  async getEscrowBalance(escrowAddress: string, tokenAddress: string, chain: ChainType): Promise<string> {
    // In production: Query blockchain for token balance
    await this.delay(200);
    return "0"; // Mock implementation
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
