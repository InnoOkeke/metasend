/**
 * Database service
 * Switches between in-memory (development) and MongoDB (production) based on configuration
 */

import { User, PendingTransfer, Contact, TransferNotification } from "../types/database";
import Constants from "expo-constants";

type ExpoExtra = {
  mongodbUri?: string;
};

const extra = (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;
const useMongoDb = !!(extra.mongodbUri || process.env.MONGODB_URI);

// Lazy import MongoDB implementation
let mongoDbInstance: any = null;
const getMongoDb = async () => {
  if (!mongoDbInstance) {
    mongoDbInstance = (await import("./mongoDatabase")).default;
  }
  return mongoDbInstance;
};

class InMemoryDatabase {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private pendingTransfers: Map<string, PendingTransfer> = new Map();
  private contacts: Map<string, Contact[]> = new Map();
  private notifications: Map<string, TransferNotification[]> = new Map();

  // User operations
  async createUser(user: User): Promise<User> {
    this.users.set(user.userId, user);
    this.usersByEmail.set(user.email.toLowerCase(), user);
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email.toLowerCase()) || null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    this.usersByEmail.set(updated.email.toLowerCase(), updated);
    return updated;
  }

  async searchUsersByEmail(query: string, limit = 10): Promise<User[]> {
    const results: User[] = [];
    const lowerQuery = query.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().includes(lowerQuery)) {
        results.push(user);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  // Pending transfer operations
  async createPendingTransfer(transfer: PendingTransfer): Promise<PendingTransfer> {
    this.pendingTransfers.set(transfer.transferId, transfer);
    return transfer;
  }

  async getPendingTransferById(transferId: string): Promise<PendingTransfer | null> {
    return this.pendingTransfers.get(transferId) || null;
  }

  async getPendingTransfersByRecipientEmail(email: string): Promise<PendingTransfer[]> {
    return Array.from(this.pendingTransfers.values()).filter(
      (t) => t.recipientEmail.toLowerCase() === email.toLowerCase() && t.status === "pending"
    );
  }

  async getPendingTransfersBySender(senderUserId: string): Promise<PendingTransfer[]> {
    return Array.from(this.pendingTransfers.values()).filter((t) => t.senderUserId === senderUserId);
  }

  async updatePendingTransfer(transferId: string, updates: Partial<PendingTransfer>): Promise<PendingTransfer | null> {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) return null;
    const updated = { ...transfer, ...updates };
    this.pendingTransfers.set(transferId, updated);
    return updated;
  }

  async getExpiredPendingTransfers(): Promise<PendingTransfer[]> {
    const now = new Date().toISOString();
    return Array.from(this.pendingTransfers.values()).filter((t) => t.status === "pending" && t.expiresAt < now);
  }

  async getExpiringPendingTransfers(hoursUntilExpiry: number): Promise<PendingTransfer[]> {
    const threshold = new Date(Date.now() + hoursUntilExpiry * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    return Array.from(this.pendingTransfers.values()).filter(
      (t) => t.status === "pending" && t.expiresAt > now && t.expiresAt <= threshold
    );
  }

  // Contact operations
  async addContact(contact: Contact): Promise<Contact> {
    const userContacts = this.contacts.get(contact.userId) || [];
    const existingIndex = userContacts.findIndex((c) => c.recipientEmail === contact.recipientEmail);
    if (existingIndex >= 0) {
      userContacts[existingIndex] = contact;
    } else {
      userContacts.push(contact);
    }
    this.contacts.set(contact.userId, userContacts);
    return contact;
  }

  async getRecentContacts(userId: string, limit = 10): Promise<Contact[]> {
    const userContacts = this.contacts.get(userId) || [];
    return userContacts.sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt)).slice(0, limit);
  }

  async getFavoriteContacts(userId: string): Promise<Contact[]> {
    const userContacts = this.contacts.get(userId) || [];
    return userContacts.filter((c) => c.favorite).sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
  }

  // Notification operations
  async createNotification(notification: TransferNotification): Promise<TransferNotification> {
    const userNotifications = this.notifications.get(notification.userId) || [];
    userNotifications.unshift(notification);
    this.notifications.set(notification.userId, userNotifications);
    return notification;
  }

  async getNotifications(userId: string, limit = 50): Promise<TransferNotification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.slice(0, limit);
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find((n) => n.notificationId === notificationId);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }
}

// Export database instance - use async function to get MongoDB instance
export const getDatabase = async () => {
  if (useMongoDb) {
    return await getMongoDb();
  }
  return inMemoryInstance;
};

// For synchronous access (in-memory only), kept for backward compatibility
const inMemoryInstance = new InMemoryDatabase();
export const db = inMemoryInstance;

// Seed with demo data (in-memory only)
if (!useMongoDb) {
  (async () => {
    const inMemoryDb = inMemoryInstance;
    await inMemoryDb.createUser({
    userId: "user_alice",
    email: "alice@metasend.io",
    emailVerified: true,
    wallets: {
      evm: "0xa11ce0000000000000000000000000000000000",
    },
    profile: {
      displayName: "Alice Base",
      avatar: "https://api.dicebear.com/7.x/initials/png?seed=Alice",
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });

  await inMemoryDb.createUser({
    userId: "user_bob",
    email: "bob@metasend.io",
    emailVerified: true,
    wallets: {
      evm: "0xb0b0000000000000000000000000000000000000",
    },
    profile: {
      displayName: "Bob Builder",
      avatar: "https://api.dicebear.com/7.x/initials/png?seed=Bob",
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
})();
}
