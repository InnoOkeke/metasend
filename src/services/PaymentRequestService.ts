/**
 * Payment Request Service
 * Handle creating and managing payment requests
 */

import { z } from "zod";
import { PaymentRequest, PaymentRequestStatus, ChainType } from "../types/database";
import { emailNotificationService } from "./EmailNotificationService";

declare const require: any;

const getApiBaseUrl = () => {
  try {
    const Constants = require("expo-constants").default;
    return Constants?.expoConfig?.extra?.metasendApiBaseUrl || process.env.METASEND_API_BASE_URL || "https://metasend.vercel.app";
  } catch {
    return process.env.METASEND_API_BASE_URL || "https://metasend.vercel.app";
  }
};

export const CreatePaymentRequestSchema = z.object({
  amount: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  description: z.string().min(1).max(500),
  payerEmail: z.string().email().optional(),
  expiresInDays: z.number().optional().default(7),
});

export type CreatePaymentRequestInput = z.infer<typeof CreatePaymentRequestSchema>;

export type PaymentRequestSummary = {
  requestId: string;
  amount: string;
  token: string;
  description: string;
  status: PaymentRequestStatus;
  payerEmail?: string;
  paidAt?: string;
  createdAt: string;
  expiresAt?: string;
};

class PaymentRequestService {
  private readonly apiBaseUrl = getApiBaseUrl();

  /**
   * Create a new payment request
   */
  async createPaymentRequest(
    creatorUserId: string,
    creatorEmail: string,
    creatorName: string | undefined,
    input: CreatePaymentRequestInput
  ): Promise<PaymentRequest> {
    const validated = CreatePaymentRequestSchema.parse(input);

    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorUserId,
        creatorEmail,
        creatorName,
        ...validated,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create payment request");
    }

    const request: PaymentRequest = await response.json();

    // Send email notification if payerEmail is provided
    if (validated.payerEmail && creatorName) {
      await emailNotificationService.sendPaymentRequestNotification(
        validated.payerEmail,
        creatorName,
        validated.amount,
        validated.token,
        validated.description,
        request.requestId
      );
    }

    return request;
  }

  /**
   * Get payment request by ID
   */
  async getPaymentRequest(requestId: string): Promise<PaymentRequest | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests?requestId=${requestId}`);
    if (!response.ok) return null;
    return await response.json();
  }

  /**
   * Get payment requests created by user
   */
  async getMyPaymentRequests(userId: string): Promise<PaymentRequestSummary[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests?creatorUserId=${userId}`);
    if (!response.ok) return [];
    return await response.json();
  }

  /**
   * Get payment requests sent to user's email
   */
  async getPaymentRequestsForEmail(email: string): Promise<PaymentRequestSummary[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests?payerEmail=${encodeURIComponent(email)}`);
    if (!response.ok) return [];
    return await response.json();
  }

  /**
   * Pay a payment request
   */
  async payPaymentRequest(
    requestId: string,
    payerUserId: string,
    payerEmail: string,
    payerName: string | undefined,
    transactionHash: string
  ): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests?requestId=${requestId}&action=pay`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        payerUserId,
        payerEmail,
        payerName,
        transactionHash,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to pay payment request");
    }
  }

  /**
   * Cancel a payment request
   */
  async cancelPaymentRequest(requestId: string, userId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/payment-requests?requestId=${requestId}&action=cancel`, {
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error("Failed to cancel payment request");
    }
  }

  /**
   * Generate shareable payment request link
   */
  generatePaymentRequestLink(requestId: string): string {
    return `https://metasend.vercel.app/pay/${requestId}`;
  }
}

export const paymentRequestService = new PaymentRequestService();
