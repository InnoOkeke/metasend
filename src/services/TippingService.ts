/**
 * Tipping Service
 * Handle tip jars and micro-tipping
 */

import { z } from "zod";
import { TipJar, Tip, TipJarStatus, ChainType } from "../types/database";

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
    
    const now = new Date();

    const jar: TipJar = {
      jarId: `jar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creatorUserId,
      creatorEmail,
      creatorName,
      creatorAvatar,
      title: validated.title,
      description: validated.description,
      suggestedAmounts: validated.suggestedAmounts,
      acceptedTokens: validated.acceptedTokens as TipJar["acceptedTokens"],
      status: "active",
      totalTipsReceived: 0,
      tipCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // TODO: Save to database
    console.log("🎁 Tip jar created:", jar);

    return jar;
  }

  /**
   * Get tip jar by ID
   */
  async getTipJar(jarId: string): Promise<TipJar | null> {
    // TODO: Fetch from database
    return null;
  }

  /**
   * Get tip jars created by user
   */
  async getMyTipJars(userId: string): Promise<TipJarSummary[]> {
    // TODO: Fetch from database
    return [];
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
    
    const tip: Tip = {
      tipId: `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      createdAt: new Date().toISOString(),
    };

    // TODO: Save to database
    // TODO: Update tip jar stats
    // TODO: Send notification to creator
    console.log("💸 Tip sent:", tip);

    return tip;
  }

  /**
   * Get tips received in a jar
   */
  async getTipsForJar(jarId: string, limit = 50): Promise<TipSummary[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Update tip jar status
   */
  async updateTipJarStatus(jarId: string, userId: string, status: TipJarStatus): Promise<void> {
    // TODO: Verify user is creator
    // TODO: Update database
    console.log("📝 Tip jar status updated:", jarId, status);
  }

  /**
   * Generate shareable tip jar link
   */
  generateTipJarLink(jarId: string): string {
    return `https://metasend.vercel.app/tip/${jarId}`;
  }
}

export const tippingService = new TippingService();
