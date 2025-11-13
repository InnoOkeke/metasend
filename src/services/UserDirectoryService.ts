/**
 * User Directory Service
 * Handles user lookup and profile retrieval
 */

import { z } from "zod";
import { db } from "./database";
import { User, ChainType } from "../types/database";

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

class UserDirectoryService {
  /**
   * Find a user by their email address
   */
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    const user = await db.getUserByEmail(email);
    if (!user) return null;

    return this.mapUserToProfile(user);
  }

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await db.getUserById(userId);
    if (!user) return null;

    return this.mapUserToProfile(user);
  }

  /**
   * Get user's wallet addresses
   */
  async getUserWallets(userId: string): Promise<UserWalletsResult | null> {
    const user = await db.getUserById(userId);
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
    const users = await db.searchUsersByEmail(validated.query, validated.limit);

    return users.map((user) => this.mapUserToProfile(user));
  }

  /**
   * Check if a user exists by email
   */
  async userExists(email: string): Promise<boolean> {
    const user = await db.getUserByEmail(email);
    return user !== null;
  }

  /**
   * Get wallet address for a specific chain
   */
  async getWalletForChain(userId: string, chain: ChainType): Promise<string | null> {
    const user = await db.getUserById(userId);
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
    await db.updateUser(userId, {
      lastLoginAt: new Date().toISOString(),
    });
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
