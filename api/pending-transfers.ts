import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pendingTransferService, CreatePendingTransferSchema } from "../src/services/PendingTransferService";

const authorize = (req: VercelRequest): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.METASEND_API_KEY}`;
};

const badRequest = (res: VercelResponse, message: string) =>
  res.status(400).json({ success: false, error: message });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorize(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const { recipientEmail, senderUserId, transferId } = req.query;

      if (recipientEmail && typeof recipientEmail === "string") {
        const transfers = await pendingTransferService.getPendingTransfers(recipientEmail);
        return res.status(200).json({ success: true, transfers });
      }

      if (senderUserId && typeof senderUserId === "string") {
        const transfers = await pendingTransferService.getSentPendingTransfers(senderUserId);
        return res.status(200).json({ success: true, transfers });
      }

      if (transferId && typeof transferId === "string") {
        const transfer = await pendingTransferService.getTransferDetails(transferId);
        return res.status(200).json({ success: true, transfer });
      }

      return badRequest(res, "Provide recipientEmail, senderUserId, or transferId");
    }

    if (req.method === "POST") {
      const parsed = CreatePendingTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.message);
      }

      const transfer = await pendingTransferService.createPendingTransfer(parsed.data);
      return res.status(201).json({ success: true, transfer });
    }

    if (req.method === "PATCH") {
      const { action } = req.body as { action?: string };
      if (!action) {
        return badRequest(res, "Action is required");
      }

      if (action === "claim") {
        const { transferId, claimantUserId } = req.body as {
          transferId?: string;
          claimantUserId?: string;
        };

        if (!transferId || !claimantUserId) {
          return badRequest(res, "transferId and claimantUserId are required");
        }

        const claimTransactionHash = await pendingTransferService.claimPendingTransfer(
          transferId,
          claimantUserId
        );
        return res.status(200).json({ success: true, claimTransactionHash });
      }

      if (action === "cancel") {
        const { transferId, senderUserId } = req.body as {
          transferId?: string;
          senderUserId?: string;
        };

        if (!transferId || !senderUserId) {
          return badRequest(res, "transferId and senderUserId are required");
        }

        const claimTransactionHash = await pendingTransferService.cancelPendingTransfer(
          transferId,
          senderUserId
        );
        return res.status(200).json({ success: true, claimTransactionHash });
      }

      if (action === "auto-claim") {
        const { userId, email } = req.body as { userId?: string; email?: string };
        if (!userId || !email) {
          return badRequest(res, "userId and email are required");
        }

        const claimedCount = await pendingTransferService.autoClaimForNewUser(userId, email);
        return res.status(200).json({ success: true, claimedCount });
      }

      return badRequest(res, `Unknown action: ${action}`);
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("❌ Pending transfers API error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
