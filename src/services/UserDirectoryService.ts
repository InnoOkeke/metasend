/**
 * User Directory Service
 * Handles user lookup and profile retrieval
 */

import { z } from "zod";
import { db } from "./database";
import { User, ChainType } from "../types/database";

declare const require: any;

export const UserSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
});

export type UserSearchRequest = z.infer<typeof UserSearchSchema>;

export type UserProfile = {
  userId: string;
  email: string;
  displayName?: string;
  avatar?: string;
  wallets: {
    evm?: string;
    solana?: string;
    tron?: string;
  };
  isVerified: boolean;
};

export type UserWalletsResult = {
  userId: string;
  email: string;
  wallets: {
    evm?: string;
    solana?: string;
    tron?: string;
  };
  hasWalletForChain: (chain: ChainType) => boolean;
};

type ExpoExtra = {
  metasendApiBaseUrl?: string;
  metasendApiKey?: string;
};

const isReactNativeEnv = typeof navigator !== "undefined" && navigator.product === "ReactNative";

const getExpoExtra = (): ExpoExtra => {
  if (!isReactNativeEnv) {
    return {};
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require("expo-constants").default;
    return (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;
  } catch (error) {
    console.warn("⚠️ Unable to load expo constants:", error);
    return {};
  }
};

class UserDirectoryService {
  private readonly useRemoteApi = isReactNativeEnv;
  private readonly extra = getExpoExtra();
  private readonly apiBaseUrl =
    (isReactNativeEnv ? this.extra.metasendApiBaseUrl : process.env.METASEND_API_BASE_URL) || "";
  private readonly apiKey =
    (isReactNativeEnv ? this.extra.metasendApiKey : process.env.METASEND_API_KEY) || "";

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiBaseUrl) {
      throw new Error("MetaSend API base URL is not configured");
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async getRemoteUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.request<{ success: boolean; user?: User }>(
        `/api/users?email=${encodeURIComponent(email)}`
      );
      return result.user ?? null;
    } catch (error) {
      console.warn("⚠️ Failed to fetch user by email:", error);
      return null;
    }
  }

  private async getRemoteUserById(userId: string): Promise<User | null> {
    try {
      const result = await this.request<{ success: boolean; user?: User }>(
        `/api/users?userId=${encodeURIComponent(userId)}`
      );
      return result.user ?? null;
    } catch (error) {
      console.warn("⚠️ Failed to fetch user by id:", error);
      return null;
    }
  }

  private async searchRemoteUsers(query: string, limit: number): Promise<User[]> {
    try {
      const result = await this.request<{ success: boolean; users?: User[] }>(
        `/api/users?search=${encodeURIComponent(query)}&limit=${limit}`
      );
      return result.users ?? [];
    } catch (error) {
      console.warn("⚠️ Failed to search users:", error);
      return [];
    }
  }

  /**
   * Find a user by their email address
   */
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    const user = this.useRemoteApi
      ? await this.getRemoteUserByEmail(email)
      : await db.getUserByEmail(email);
    if (!user) return null;

    return this.mapUserToProfile(user);
  }

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = this.useRemoteApi
      ? await this.getRemoteUserById(userId)
      : await db.getUserById(userId);
    if (!user) return null;

    return this.mapUserToProfile(user);
  }

  /**
   * Get user's wallet addresses
   */
  async getUserWallets(userId: string): Promise<UserWalletsResult | null> {
    const user = this.useRemoteApi
      ? await this.getRemoteUserById(userId)
      : await db.getUserById(userId);
    if (!user) return null;

    return {
      userId: user.userId,
      email: user.email,
      wallets: user.wallets,
      hasWalletForChain: (chain: ChainType) => {
        return Boolean(user.wallets[chain]);
      },
    };
  }

  /**
   * Search users by email query
   */
  async searchUsers(request: UserSearchRequest): Promise<UserProfile[]> {
    const validated = UserSearchSchema.parse(request);
    const users = this.useRemoteApi
      ? await this.searchRemoteUsers(validated.query, validated.limit)
      : await db.searchUsersByEmail(validated.query, validated.limit);

    return users.map((user) => this.mapUserToProfile(user));
  }

  /**
   * Check if a user exists by email
   */
  async userExists(email: string): Promise<boolean> {
    const user = this.useRemoteApi
      ? await this.getRemoteUserByEmail(email)
      : await db.getUserByEmail(email);
    return user !== null;
  }

  /**
   * Get wallet address for a specific chain
   */
  async getWalletForChain(userId: string, chain: ChainType): Promise<string | null> {
    const user = this.useRemoteApi
      ? await this.getRemoteUserById(userId)
      : await db.getUserById(userId);
    if (!user) return null;

    return user.wallets[chain] || null;
  }

  /**
   * Register a new user (called after Coinbase auth)
   */
  async registerUser(data: {
    userId: string;
    email: string;
    emailVerified: boolean;
    walletAddress?: string;
    displayName?: string;
    avatar?: string;
  }): Promise<UserProfile> {
    if (this.useRemoteApi) {
      const response = await this.request<{ success: boolean; user: User }>("/api/users", {
        method: "POST",
        body: JSON.stringify({
          userId: data.userId,
          email: data.email,
          emailVerified: data.emailVerified,
          walletAddress: data.walletAddress,
          displayName: data.displayName,
          avatar: data.avatar,
        }),
      });

      return this.mapUserToProfile(response.user);
    }

    const user: User = {
      userId: data.userId,
      email: data.email,
      emailVerified: data.emailVerified,
      wallets: {
        evm: data.walletAddress,
      },
      profile: {
        displayName: data.displayName,
        avatar: data.avatar,
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    await db.createUser(user);
    return this.mapUserToProfile(user);
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    const payload = {
      lastLoginAt: new Date().toISOString(),
    };

    if (this.useRemoteApi) {
      await this.request("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, updates: payload }),
      });
      return;
    }

    await db.updateUser(userId, payload);
  }

  private mapUserToProfile(user: User): UserProfile {
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.profile.displayName,
      avatar: user.profile.avatar,
      wallets: user.wallets,
      isVerified: user.emailVerified,
    };
  }
}

// Export singleton instance
export const userDirectoryService = new UserDirectoryService();
