/**
 * Tipping API
 * Handles creating tip jars, sending tips, and retrieving tip data
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import mongoDb from "../src/services/mongoDatabase";
import { TipJar, Tip, TipJarStatus } from "../src/types/database";

const CreateTipJarSchema = z.object({
  creatorUserId: z.string(),
  creatorEmail: z.string().email(),
  creatorName: z.string().optional(),
  creatorAvatar: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  suggestedAmounts: z.array(z.number()),
  acceptedTokens: z.array(
    z.object({
      token: z.string(),
      chain: z.enum(["evm", "solana", "tron"]),
    })
  ),
});

const SendTipSchema = z.object({
  jarId: z.string(),
  tipperUserId: z.string().optional(),
  tipperEmail: z.string().email().optional(),
  tipperName: z.string().optional(),
  isAnonymous: z.boolean(),
  amount: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  message: z.string().optional(),
  transactionHash: z.string(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // GET - Retrieve tip jars or tips
    if (req.method === "GET") {
      const { jarId, creatorUserId, tipperUserId, type } = req.query;

      // Get specific jar
      if (jarId && type !== "tips") {
        const jar = await mongoDb.getTipJarById(jarId as string);
        if (!jar) {
          return res.status(404).json({ error: "Tip jar not found" });
        }
        return res.status(200).json(jar);
      }

      // Get tips for a jar
      if (jarId && type === "tips") {
        const tips = await mongoDb.getTipsByJar(jarId as string);
        return res.status(200).json(tips);
      }

      // Get jars by creator
      if (creatorUserId) {
        const jars = await mongoDb.getTipJarsByCreator(creatorUserId as string);
        return res.status(200).json(jars);
      }

      // Get tips by tipper
      if (tipperUserId) {
        const tips = await mongoDb.getTipsByTipper(tipperUserId as string);
        return res.status(200).json(tips);
      }

      return res.status(400).json({ error: "Missing query parameters" });
    }

    // POST - Create tip jar or send tip
    if (req.method === "POST") {
      const { action } = req.query;

      // Create tip jar
      if (action === "create-jar") {
        const validation = CreateTipJarSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ error: validation.error.errors });
        }

        const data = validation.data;
        const jarId = `jar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();

        const jar: TipJar = {
          jarId,
          creatorUserId: data.creatorUserId,
          creatorEmail: data.creatorEmail.toLowerCase().trim(),
          creatorName: data.creatorName,
          creatorAvatar: data.creatorAvatar,
          title: data.title,
          description: data.description,
          suggestedAmounts: data.suggestedAmounts,
          acceptedTokens: data.acceptedTokens,
          status: "active",
          totalTipsReceived: 0,
          tipCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        await mongoDb.createTipJar(jar);
        return res.status(201).json(jar);
      }

      // Send tip
      if (action === "send-tip") {
        const validation = SendTipSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ error: validation.error.errors });
        }

        const data = validation.data;

        // Verify jar exists and is active
        const jar = await mongoDb.getTipJarById(data.jarId);
        if (!jar) {
          return res.status(404).json({ error: "Tip jar not found" });
        }
        if (jar.status !== "active") {
          return res.status(400).json({ error: "Tip jar is not active" });
        }

        const tipId = `tip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();

        const tip: Tip = {
          tipId,
          jarId: data.jarId,
          tipperUserId: data.tipperUserId,
          tipperEmail: data.tipperEmail?.toLowerCase().trim(),
          tipperName: data.tipperName,
          isAnonymous: data.isAnonymous,
          amount: data.amount,
          token: data.token,
          chain: data.chain,
          message: data.message,
          transactionHash: data.transactionHash,
          createdAt: now,
        };

        await mongoDb.createTip(tip);

        // Update jar stats
        const amount = parseFloat(data.amount);
        await mongoDb.updateTipJar(data.jarId, {
          totalTipsReceived: jar.totalTipsReceived + amount,
          tipCount: jar.tipCount + 1,
          updatedAt: now,
        });

        return res.status(201).json(tip);
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    // PATCH - Update tip jar status
    if (req.method === "PATCH") {
      const { jarId, status } = req.query;

      if (!jarId || !status) {
        return res.status(400).json({ error: "Missing jarId or status" });
      }

      const validStatuses: TipJarStatus[] = ["active", "paused", "closed"];
      if (!validStatuses.includes(status as TipJarStatus)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await mongoDb.updateTipJar(jarId as string, {
        status: status as TipJarStatus,
        updatedAt: new Date().toISOString(),
      });

      if (!updated) {
        return res.status(404).json({ error: "Tip jar not found" });
      }

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Tips API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
