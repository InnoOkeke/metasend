import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getDatabase } from "../src/services/database";
import type { TransferRecord } from "../src/types/transfers";

const authorize = (req: VercelRequest): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.METASEND_API_KEY}`;
};

const badRequest = (res: VercelResponse, message: string) =>
  res.status(400).json({ success: false, error: message });

const TransferIntentSchema = z.object({
  recipientEmail: z.string().email(),
  amountUsdc: z.number().nonnegative(),
  memo: z.string().optional(),
  senderEmail: z.string().email().optional(),
  senderName: z.string().optional(),
  senderUserId: z.string().optional(),
});

const TransferRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  senderWallet: z.string(),
  intent: TransferIntentSchema,
  status: z.enum(["sent", "pending_recipient_signup"]),
  txHash: z.string().optional(),
  redemptionCode: z.string().optional(),
  recipientWallet: z.string().optional(),
  pendingTransferId: z.string().optional(),
});

type ListFilter = {
  senderWallet?: string;
  senderUserId?: string;
  limit?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorize(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const db = await getDatabase();

    if (req.method === "GET") {
      const filter: ListFilter = {};
      if (typeof req.query.senderWallet === "string") {
        filter.senderWallet = req.query.senderWallet;
      }
      if (typeof req.query.senderUserId === "string") {
        filter.senderUserId = req.query.senderUserId;
      }
      if (typeof req.query.limit === "string") {
        const parsedLimit = Number(req.query.limit);
        if (!Number.isNaN(parsedLimit)) {
          filter.limit = parsedLimit;
        }
      }

      if (!filter.senderWallet && !filter.senderUserId) {
        return badRequest(res, "Provide senderWallet or senderUserId");
      }

      const transfers = await db.listTransferRecords(filter);
      return res.status(200).json({ success: true, transfers });
    }

    if (req.method === "POST") {
      const parsed = TransferRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.message);
      }

      await db.saveTransferRecord(parsed.data as TransferRecord);
      return res.status(201).json({ success: true, transfer: parsed.data });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("❌ Transfers API error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
