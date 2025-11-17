/**
 * API Client for MetaSend Backend
 * 
 * This file contains client-side wrappers for calling the MetaSend API.
 * Mobile app should NEVER import server services directly (they use MongoDB/Node.js libs).
 */

import Constants from "expo-constants";

const API_BASE_URL = Constants.expoConfig?.extra?.METASEND_API_BASE_URL;
const API_KEY = Constants.expoConfig?.extra?.METASEND_API_KEY;

if (!API_BASE_URL) {
  console.warn("⚠️ METASEND_API_BASE_URL not configured");
}

if (!API_KEY) {
  console.warn("⚠️ METASEND_API_KEY not configured");
}

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Generic API request wrapper
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || "API request failed");
    }

    return data as T;
  } catch (error) {
    console.error(`❌ API request failed [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * User Registration/Update API
 */
export interface RegisterUserParams {
  userId: string;
  email: string;
  emailVerified: boolean;
  walletAddress: string;
  displayName?: string;
  photoUrl?: string;
}

export interface UserProfile {
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
}

interface RegisterUserResponse extends ApiResponse<UserProfile> {
  user: UserProfile;
}

/**
 * Register or update a user in the directory
 */
export async function registerUser(
  params: RegisterUserParams
): Promise<UserProfile> {
  const response = await apiRequest<RegisterUserResponse>("/api/users", {
    method: "POST",
    body: JSON.stringify({
      userId: params.userId,
      email: params.email,
      emailVerified: params.emailVerified,
      walletAddress: params.walletAddress,
      displayName: params.displayName,
      avatar: params.photoUrl,
    }),
  });

  return response.user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const response = await apiRequest<RegisterUserResponse>(
      `/api/users?email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );
    return response.user;
  } catch (error) {
    // User not found is not an error
    if (error instanceof Error && error.message.includes("not found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Search users by email prefix
 */
export async function searchUsersByEmail(
  search: string,
  limit = 10
): Promise<UserProfile[]> {
  interface SearchResponse extends ApiResponse<UserProfile[]> {
    users: UserProfile[];
  }
  
  const response = await apiRequest<SearchResponse>(
    `/api/users?search=${encodeURIComponent(search)}&limit=${limit}`,
    { method: "GET" }
  );
  
  return response.users;
}

/**
 * Pending Transfers API
 */
export interface PendingTransferSummary {
  transferId: string;
  senderUserId: string;
  senderEmail: string;
  recipientEmail: string;
  amount: string;
  message?: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "claimed" | "expired" | "cancelled";
}

export interface PendingTransferDetails extends PendingTransferSummary {
  escrowWalletAddress: string;
  transactionHash?: string;
  claimedAt?: string;
  claimedBy?: string;
  cancelledAt?: string;
  refundTransactionHash?: string;
}

/**
 * Get pending transfers for a recipient email
 */
export async function getPendingTransfers(
  recipientEmail: string
): Promise<PendingTransferSummary[]> {
  interface PendingTransfersResponse extends ApiResponse<PendingTransferSummary[]> {
    transfers: PendingTransferSummary[];
  }
  
  const response = await apiRequest<PendingTransfersResponse>(
    `/api/pending-transfers?recipientEmail=${encodeURIComponent(recipientEmail)}`,
    { method: "GET" }
  );
  
  return response.transfers;
}

/**
 * Get pending transfers sent by a user
 */
export async function getSentPendingTransfers(
  senderUserId: string
): Promise<PendingTransferSummary[]> {
  interface PendingTransfersResponse extends ApiResponse<PendingTransferSummary[]> {
    transfers: PendingTransferSummary[];
  }
  
  const response = await apiRequest<PendingTransfersResponse>(
    `/api/pending-transfers?senderUserId=${encodeURIComponent(senderUserId)}`,
    { method: "GET" }
  );
  
  return response.transfers;
}

/**
 * Get transfer details by ID
 */
export async function getTransferDetails(
  transferId: string
): Promise<PendingTransferDetails> {
  interface TransferDetailsResponse extends ApiResponse<PendingTransferDetails> {
    transfer: PendingTransferDetails;
  }
  
  const response = await apiRequest<TransferDetailsResponse>(
    `/api/pending-transfers?transferId=${encodeURIComponent(transferId)}`,
    { method: "GET" }
  );
  
  return response.transfer;
}

/**
 * Claim a pending transfer
 */
export async function claimPendingTransfer(
  transferId: string,
  claimantUserId: string
): Promise<string> {
  interface ClaimResponse extends ApiResponse<string> {
    claimTransactionHash: string;
  }
  
  const response = await apiRequest<ClaimResponse>(
    `/api/pending-transfers`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: "claim",
        transferId,
        claimantUserId,
      }),
    }
  );
  
  return response.claimTransactionHash;
}

/**
 * Cancel a pending transfer
 */
export async function cancelPendingTransfer(
  transferId: string,
  senderUserId: string
): Promise<string> {
  interface CancelResponse extends ApiResponse<string> {
    refundTransactionHash: string;
  }
  
  const response = await apiRequest<CancelResponse>(
    `/api/pending-transfers`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: "cancel",
        transferId,
        senderUserId,
      }),
    }
  );
  
  return response.refundTransactionHash;
}

export default {
  registerUser,
  getUserByEmail,
  searchUsersByEmail,
  getPendingTransfers,
  getSentPendingTransfers,
  getTransferDetails,
  claimPendingTransfer,
  cancelPendingTransfer,
};
