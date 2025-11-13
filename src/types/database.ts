/**
 * Database type definitions for MetaSend
 * These can be implemented with Firebase, Supabase, MongoDB, etc.
 */

export type ChainType = "evm" | "solana" | "tron";

export type User = {
  userId: string;
  email: string;
  emailVerified: boolean;
  wallets: {
    evm?: string;
    solana?: string;
    tron?: string;
  };
  profile: {
    displayName?: string;
    avatar?: string;
  };
  createdAt: string;
  lastLoginAt: string;
};

export type PendingTransferStatus = "pending" | "claimed" | "cancelled" | "expired";

export type PendingTransfer = {
  transferId: string;
  recipientEmail: string;
  senderUserId: string;
  senderEmail: string;
  senderName?: string;

  // Transfer details
  amount: string;
  token: string;
  tokenAddress: string;
  chain: ChainType;
  decimals: number;

  // Status
  status: PendingTransferStatus;

  // Escrow wallet (holds funds)
  escrowAddress: string;
  escrowPrivateKeyEncrypted: string;
  transactionHash: string; // Initial deposit tx

  // Metadata
  message?: string;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
  claimedByUserId?: string;
  claimTransactionHash?: string;
};

export type Contact = {
  userId: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientName?: string;
  lastSentAt: string;
  totalSent: number;
  favorite: boolean;
};

export type TransferNotification = {
  notificationId: string;
  userId: string;
  type: "transfer_received" | "transfer_sent" | "pending_claimed" | "pending_expired" | "invite_sent";
  title: string;
  message: string;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: string;
};
