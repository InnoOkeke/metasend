/**
 * Tipping Service
 * Handle tip jars and micro-tipping
 */

import { z } from "zod";
import { TipJar, Tip, TipJarStatus, ChainType } from "../types/database";

declare const require: any;

const getApiBaseUrl = () => {
  try {
    const Constants = require("expo-constants").default;
    return Constants?.expoConfig?.extra?.metasendApiBaseUrl || process.env.METASEND_API_BASE_URL || "https://metasend.vercel.app";
  } catch (_error) {
    return process.env.METASEND_API_BASE_URL || "https://metasend.vercel.app";
  }
};

export const CreateTipJarSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  suggestedAmounts: z.array(z.number()).min(1).max(6),
  acceptedTokens: z.array(z.object({
    token: z.string(),
    chain: z.enum(["evm", "solana", "tron"]),
  })),
});

export const SendTipSchema = z.object({
  jarId: z.string(),
  amount: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  message: z.string().max(280).optional(),
  isAnonymous: z.boolean().optional().default(false),
});

export type CreateTipJarInput = z.infer<typeof CreateTipJarSchema>;
export type SendTipInput = z.infer<typeof SendTipSchema>;

export type TipJarSummary = {
  jarId: string;
  title: string;
  description?: string;
  creatorName?: string;
  creatorAvatar?: string;
  totalTipsReceived: number;
  tipCount: number;
  status: TipJarStatus;
};

export type TipSummary = {
  tipId: string;
  amount: string;
  token: string;
  tipperName?: string;
  isAnonymous: boolean;
  message?: string;
  createdAt: string;
};

class TippingService {
  private readonly apiBaseUrl = getApiBaseUrl();

  /**
   * Create a new tip jar
   */
  async createTipJar(
    creatorUserId: string,
    creatorEmail: string,
    creatorName: string | undefined,
    creatorAvatar: string | undefined,
    input: CreateTipJarInput
  ): Promise<TipJar> {
    const validated = CreateTipJarSchema.parse(input);

    const response = await fetch(`${this.apiBaseUrl}/api/tips?action=create-jar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorUserId,
        creatorEmail,
        creatorName,
        creatorAvatar,
        ...validated,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create tip jar");
    }

    return await response.json();
  }

  /**
   * Get tip jar by ID
   */
  async getTipJar(jarId: string): Promise<TipJar | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/tips?jarId=${jarId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  }

  /**
   * Get tip jars created by user
   */
  async getMyTipJars(userId: string): Promise<TipJarSummary[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/tips?creatorUserId=${userId}`);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  }

  /**
   * Send a tip
   */
  async sendTip(
    tipperUserId: string | undefined,
    tipperEmail: string | undefined,
    tipperName: string | undefined,
    input: SendTipInput,
    transactionHash: string
  ): Promise<Tip> {
    const validated = SendTipSchema.parse(input);

    const response = await fetch(`${this.apiBaseUrl}/api/tips?action=send-tip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jarId: validated.jarId,
        tipperUserId: validated.isAnonymous ? undefined : tipperUserId,
        tipperEmail: validated.isAnonymous ? undefined : tipperEmail,
        tipperName: validated.isAnonymous ? undefined : tipperName,
        isAnonymous: validated.isAnonymous,
        amount: validated.amount,
        token: validated.token,
        chain: validated.chain,
        message: validated.message,
        transactionHash,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send tip");
    }

    return await response.json();
  }

  /**
   * Get tips received in a jar
   */
  async getTipsForJar(jarId: string, limit = 50): Promise<TipSummary[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/tips?jarId=${jarId}&type=tips`);
    if (!response.ok) {
      return [];
    }
    const tips: TipSummary[] = await response.json();
    return tips.slice(0, limit);
  }

  /**
   * Update tip jar status
   */
  async updateTipJarStatus(jarId: string, userId: string, status: TipJarStatus): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/tips?jarId=${jarId}&status=${status}`, {
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error("Failed to update tip jar status");
    }
  }

  /**
   * Generate shareable tip jar link
   */
  generateTipJarLink(jarId: string): string {
    return `https://metasend.vercel.app/tip/${jarId}`;
  }
}

export const tippingService = new TippingService();
