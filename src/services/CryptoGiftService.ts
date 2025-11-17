/**
 * Crypto Gift Service
 * Handle themed crypto gifts and red envelopes
 */

import { z } from "zod";
import { CryptoGift, GiftTheme, GiftStatus, ChainType } from "../types/database";

export const CreateGiftSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  amount: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  theme: z.enum(["birthday", "anniversary", "holiday", "thank_you", "congratulations", "red_envelope", "custom"]),
  message: z.string().max(500).optional(),
  expiresInDays: z.number().optional().default(30),
});

export type CreateGiftInput = z.infer<typeof CreateGiftSchema>;

export type GiftSummary = {
  giftId: string;
  recipientEmail: string;
  recipientName?: string;
  amount: string;
  token: string;
  theme: GiftTheme;
  status: GiftStatus;
  createdAt: string;
  claimedAt?: string;
  expiresAt?: string;
};

export type GiftThemeConfig = {
  theme: GiftTheme;
  emoji: string;
  name: string;
  description: string;
  backgroundColor: string;
  primaryColor: string;
};

class CryptoGiftService {
  private readonly GIFT_THEMES: Record<GiftTheme, GiftThemeConfig> = {
    birthday: {
      theme: "birthday",
      emoji: "🎂",
      name: "Birthday",
      description: "Happy Birthday!",
      backgroundColor: "#FEF3C7",
      primaryColor: "#F59E0B",
    },
    anniversary: {
      theme: "anniversary",
      emoji: "💝",
      name: "Anniversary",
      description: "Happy Anniversary!",
      backgroundColor: "#FCE7F3",
      primaryColor: "#EC4899",
    },
    holiday: {
      theme: "holiday",
      emoji: "🎄",
      name: "Holiday",
      description: "Happy Holidays!",
      backgroundColor: "#D1FAE5",
      primaryColor: "#10B981",
    },
    thank_you: {
      theme: "thank_you",
      emoji: "🙏",
      name: "Thank You",
      description: "Thank you!",
      backgroundColor: "#E0E7FF",
      primaryColor: "#6366F1",
    },
    congratulations: {
      theme: "congratulations",
      emoji: "🎉",
      name: "Congratulations",
      description: "Congratulations!",
      backgroundColor: "#DBEAFE",
      primaryColor: "#3B82F6",
    },
    red_envelope: {
      theme: "red_envelope",
      emoji: "🧧",
      name: "Red Envelope",
      description: "Good fortune!",
      backgroundColor: "#FEE2E2",
      primaryColor: "#DC2626",
    },
    custom: {
      theme: "custom",
      emoji: "🎁",
      name: "Custom Gift",
      description: "A special gift",
      backgroundColor: "#F3E8FF",
      primaryColor: "#A855F7",
    },
  };

  /**
   * Create a new crypto gift
   */
  async createGift(
    senderUserId: string,
    senderEmail: string,
    senderName: string | undefined,
    input: CreateGiftInput
  ): Promise<CryptoGift> {
    const validated = CreateGiftSchema.parse(input);
    
    const now = new Date();
    const expiresAt = validated.expiresInDays
      ? new Date(now.getTime() + validated.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const gift: CryptoGift = {
      giftId: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderUserId,
      senderEmail,
      senderName,
      recipientEmail: validated.recipientEmail.toLowerCase().trim(),
      recipientName: validated.recipientName,
      amount: validated.amount,
      token: validated.token,
      chain: validated.chain,
      theme: validated.theme,
      message: validated.message,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: expiresAt?.toISOString(),
    };

    // TODO: Generate escrow wallet for gift
    // TODO: Transfer funds to escrow
    // TODO: Save to database
    console.log("🎁 Gift created:", gift);

    // TODO: Send email notification to recipient
    await this.sendGiftEmail(gift);

    return gift;
  }

  /**
   * Get gift by ID
   */
  async getGift(giftId: string): Promise<CryptoGift | null> {
    // TODO: Fetch from database
    return null;
  }

  /**
   * Get gifts sent by user
   */
  async getSentGifts(userId: string): Promise<GiftSummary[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Get gifts received by email
   */
  async getReceivedGifts(email: string): Promise<GiftSummary[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Claim a gift
   */
  async claimGift(
    giftId: string,
    claimantUserId: string,
    claimantEmail: string
  ): Promise<string> {
    // TODO: Verify claimant email matches recipient
    // TODO: Check if gift is still valid (not expired/claimed)
    // TODO: Transfer from escrow to claimant's wallet
    // TODO: Update gift status
    // TODO: Send confirmation emails
    console.log("✅ Gift claimed:", giftId);
    
    return "0x..."; // transaction hash
  }

  /**
   * Cancel a gift (sender only, if unclaimed)
   */
  async cancelGift(giftId: string, userId: string): Promise<void> {
    // TODO: Verify user is sender
    // TODO: Verify gift is unclaimed
    // TODO: Return funds from escrow to sender
    // TODO: Update gift status
    console.log("❌ Gift cancelled:", giftId);
  }

  /**
   * Process expired gifts
   */
  async processExpiredGifts(): Promise<number> {
    // TODO: Query database for expired unclaimed gifts
    // TODO: Return funds from escrow to sender
    // TODO: Update gift status
    // TODO: Send expiration notifications
    console.log("⏰ Processing expired gifts...");
    return 0;
  }

  /**
   * Send gift email notification
   */
  private async sendGiftEmail(gift: CryptoGift): Promise<void> {
    const themeConfig = this.GIFT_THEMES[gift.theme];
    // TODO: Integrate with EmailNotificationService
    console.log(`📧 Sending ${themeConfig.emoji} gift email to:`, gift.recipientEmail);
  }

  /**
   * Get gift theme configuration
   */
  getGiftTheme(theme: GiftTheme): GiftThemeConfig {
    return this.GIFT_THEMES[theme];
  }

  /**
   * Get all available themes
   */
  getAllThemes(): GiftThemeConfig[] {
    return Object.values(this.GIFT_THEMES);
  }

  /**
   * Generate shareable gift link
   */
  generateGiftLink(giftId: string): string {
    return `https://metasend.vercel.app/gift/${giftId}`;
  }
}

export const cryptoGiftService = new CryptoGiftService();
