/**
 * Payment Requests API
 * Handles creating, retrieving, and managing payment requests
 */

import { Request, Response, Router } from "express";
import { z } from "zod";
import mongoDb from "../src/services/mongoDatabase";
import { PaymentRequest, PaymentRequestStatus } from "../src/types/database";

const CreatePaymentRequestSchema = z.object({
  creatorUserId: z.string(),
  creatorEmail: z.string().email(),
  creatorName: z.string().optional(),
  amount: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  description: z.string(),
  payerEmail: z.string().email().optional(),
  expiresInDays: z.number().optional(),
});

const PayPaymentRequestSchema = z.object({
  requestId: z.string(),
  payerUserId: z.string(),
  payerEmail: z.string().email(),
  payerName: z.string().optional(),
  transactionHash: z.string(),
});

const router = Router();
router.get('/', async (req: Request, res: Response) => {
  try {
    const { creatorUserId, payerEmail, requestId } = req.query;
    if (requestId) {
      const request = await mongoDb.getPaymentRequestById(requestId as string);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      return res.status(200).json(request);
    }
    if (creatorUserId) {
      const requests = await mongoDb.getPaymentRequestsByCreator(creatorUserId as string);
      return res.status(200).json(requests);
    }
    if (payerEmail) {
      const requests = await mongoDb.getPaymentRequestsByPayer(payerEmail as string);
      return res.status(200).json(requests);
    }
    return res.status(400).json({ error: "Missing query parameters" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = CreatePaymentRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }
    const data = validation.data;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const request: PaymentRequest = {
      requestId,
      creatorUserId: data.creatorUserId,
      creatorEmail: data.creatorEmail.toLowerCase().trim(),
      creatorName: data.creatorName,
      amount: data.amount,
      token: data.token,
      chain: data.chain,
      description: data.description,
      // ...existing code...
    };
    // ...existing code for saving and returning...
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
        payerEmail: data.payerEmail?.toLowerCase().trim(),
        status: "pending",
        createdAt: now,
        expiresAt,
      };

      await mongoDb.createPaymentRequest(request);
      return res.status(201).json(request);
    }

    // PATCH - Update payment request (pay, cancel, etc.)
    if (req.method === "PATCH") {
      const { requestId, action } = req.query;

      if (!requestId || !action) {
        return res.status(400).json({ error: "Missing requestId or action" });
      }

      const request = await mongoDb.getPaymentRequestById(requestId as string);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }

      // Pay action
      if (action === "pay") {
        const validation = PayPaymentRequestSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ error: validation.error.errors });
        }

        if (request.status !== "pending") {
          return res.status(400).json({ error: "Payment request is not pending" });
        }

        const data = validation.data;
        const updates = {
          status: "paid" as PaymentRequestStatus,
          payerUserId: data.payerUserId,
          payerEmail: data.payerEmail.toLowerCase().trim(),
          payerName: data.payerName,
          transactionHash: data.transactionHash,
          paidAt: new Date().toISOString(),
        };

        const updated = await mongoDb.updatePaymentRequest(requestId as string, updates);
        return res.status(200).json(updated);
      }

      // Cancel action
      if (action === "cancel") {
        if (request.status !== "pending") {
          return res.status(400).json({ error: "Payment request is not pending" });
        }

        const updated = await mongoDb.updatePaymentRequest(requestId as string, {
          status: "cancelled" as PaymentRequestStatus,
        });
        return res.status(200).json(updated);
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Payment requests API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
