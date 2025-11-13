/**
 * MongoDB database implementation
 * Production-ready database service using MongoDB Atlas
 */

import { MongoClient, Db, Collection } from "mongodb";
import Constants from "expo-constants";
import { User, PendingTransfer, Contact, TransferNotification } from "../types/database";

type ExpoExtra = {
  mongodbUri?: string;
};

class MongoDatabase {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly extra = (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;

  private async connect(): Promise<Db> {
    if (this.db) return this.db;

    const uri = this.extra.mongodbUri || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI not configured in environment variables");
    }

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db("metasend");

    // Create indexes
    await this.createIndexes();

    return this.db;
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    // Users collection indexes
    await this.db.collection("users").createIndex({ email: 1 }, { unique: true });
    await this.db.collection("users").createIndex({ userId: 1 }, { unique: true });

    // Pending transfers indexes
    await this.db.collection("pendingTransfers").createIndex({ transferId: 1 }, { unique: true });
    await this.db.collection("pendingTransfers").createIndex({ recipientEmail: 1 });
    await this.db.collection("pendingTransfers").createIndex({ senderUserId: 1 });
    await this.db.collection("pendingTransfers").createIndex({ status: 1, expiresAt: 1 });

    // Contacts indexes
    await this.db.collection("contacts").createIndex({ userId: 1, recipientEmail: 1 }, { unique: true });
    await this.db.collection("contacts").createIndex({ userId: 1, lastSentAt: -1 });
    await this.db.collection("contacts").createIndex({ userId: 1, favorite: 1 });

    // Notifications indexes
    await this.db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
    await this.db.collection("notifications").createIndex({ notificationId: 1 }, { unique: true });
  }

  private async getCollection<T extends Record<string, any>>(name: string): Promise<Collection<T>> {
    const db = await this.connect();
    return db.collection<T>(name);
  }

  // User operations
  async createUser(user: User): Promise<User> {
    const collection = await this.getCollection<User>("users");
    await collection.insertOne(user as any);
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    const collection = await this.getCollection<User>("users");
    return await collection.findOne({ userId } as any);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const collection = await this.getCollection<User>("users");
    return await collection.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } } as any);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const collection = await this.getCollection<User>("users");
    const result = await collection.findOneAndUpdate(
      { userId } as any,
      { $set: updates as any },
      { returnDocument: "after" }
    );
    return result || null;
  }

  async searchUsersByEmail(query: string, limit = 10): Promise<User[]> {
    const collection = await this.getCollection<User>("users");
    return await collection
      .find({ email: { $regex: new RegExp(query, "i") } } as any)
      .limit(limit)
      .toArray();
  }

  // Pending transfer operations
  async createPendingTransfer(transfer: PendingTransfer): Promise<PendingTransfer> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    await collection.insertOne(transfer as any);
    return transfer;
  }

  async getPendingTransferById(transferId: string): Promise<PendingTransfer | null> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    return await collection.findOne({ transferId } as any);
  }

  async getPendingTransfersByRecipientEmail(email: string): Promise<PendingTransfer[]> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    return await collection
      .find({
        recipientEmail: { $regex: new RegExp(`^${email}$`, "i") },
        status: "pending",
      } as any)
      .toArray();
  }

  async getPendingTransfersBySender(senderUserId: string): Promise<PendingTransfer[]> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    return await collection.find({ senderUserId } as any).toArray();
  }

  async updatePendingTransfer(
    transferId: string,
    updates: Partial<PendingTransfer>
  ): Promise<PendingTransfer | null> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    const result = await collection.findOneAndUpdate(
      { transferId } as any,
      { $set: updates as any },
      { returnDocument: "after" }
    );
    return result || null;
  }

  async getExpiredPendingTransfers(): Promise<PendingTransfer[]> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    const now = new Date().toISOString();
    return await collection
      .find({
        status: "pending",
        expiresAt: { $lt: now },
      } as any)
      .toArray();
  }

  async getExpiringPendingTransfers(hoursUntilExpiry: number): Promise<PendingTransfer[]> {
    const collection = await this.getCollection<PendingTransfer>("pendingTransfers");
    const now = new Date().toISOString();
    const threshold = new Date(Date.now() + hoursUntilExpiry * 60 * 60 * 1000).toISOString();
    return await collection
      .find({
        status: "pending",
        expiresAt: { $gt: now, $lte: threshold },
      } as any)
      .toArray();
  }

  // Contact operations
  async addContact(contact: Contact): Promise<Contact> {
    const collection = await this.getCollection<Contact>("contacts");
    await collection.updateOne(
      { userId: contact.userId, recipientEmail: contact.recipientEmail } as any,
      { $set: contact as any },
      { upsert: true }
    );
    return contact;
  }

  async getRecentContacts(userId: string, limit = 10): Promise<Contact[]> {
    const collection = await this.getCollection<Contact>("contacts");
    return await collection
      .find({ userId } as any)
      .sort({ lastSentAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getFavoriteContacts(userId: string): Promise<Contact[]> {
    const collection = await this.getCollection<Contact>("contacts");
    return await collection
      .find({ userId, favorite: true } as any)
      .sort({ lastSentAt: -1 })
      .toArray();
  }

  // Notification operations
  async createNotification(notification: TransferNotification): Promise<TransferNotification> {
    const collection = await this.getCollection<TransferNotification>("notifications");
    await collection.insertOne(notification as any);
    return notification;
  }

  async getNotifications(userId: string, limit = 50): Promise<TransferNotification[]> {
    const collection = await this.getCollection<TransferNotification>("notifications");
    return await collection
      .find({ userId } as any)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const collection = await this.getCollection<TransferNotification>("notifications");
    const result = await collection.updateOne(
      { notificationId, userId } as any,
      { $set: { read: true } as any }
    );
    return result.modifiedCount > 0;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

// Export singleton instance
const mongoDb = new MongoDatabase();
export default mongoDb;