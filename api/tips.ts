/**
 * Tipping API
 * Handles creating tip jars, sending tips, and retrieving tip data
 */

import { Request, Response, Router } from "express";
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

const router = Router();

// GET tip jars or tips
router.get('/', async (req: Request, res: Response) => {
  try {
    const { jarId, creatorUserId, tipperUserId, type } = req.query;
    if (jarId && typeof jarId === 'string' && type !== 'tips') {
      const jar = await mongoDb.getTipJarById(jarId);
      if (!jar) return res.status(404).json({ error: 'Tip jar not found' });
      return res.status(200).json(jar);
    }
    if (jarId && typeof jarId === 'string' && type === 'tips') {
      const tips = await mongoDb.getTipsByJar(jarId);
      return res.status(200).json(tips);
    }
    if (creatorUserId && typeof creatorUserId === 'string') {
      const jars = await mongoDb.getTipJarsByCreator(creatorUserId);
      return res.status(200).json(jars);
    }
    if (tipperUserId && typeof tipperUserId === 'string') {
      const tips = await mongoDb.getTipsByTipper(tipperUserId);
      return res.status(200).json(tips);
    }
    return res.status(400).json({ error: 'Missing query parameters' });
  } catch (err) {
    console.error('Tips GET error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create jar or send tip (action query param)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { action } = req.query;
    if (action === 'create-jar') {
      const validation = CreateTipJarSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: validation.error.errors });
      const data = validation.data;

      const jarId = `jar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      const jar: any = {
        jarId,
        creatorUserId: data.creatorUserId,
        creatorEmail: data.creatorEmail.toLowerCase().trim(),
        creatorName: data.creatorName,
        creatorAvatar: data.creatorAvatar,
        title: data.title,
        description: data.description,
        suggestedAmounts: data.suggestedAmounts,
        acceptedTokens: data.acceptedTokens,
        status: 'active',
        totalTipsReceived: 0,
        tipCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await mongoDb.createTipJar(jar);
      return res.status(201).json(jar);
    }

    if (action === 'send-tip') {
      const validation = SendTipSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: validation.error.errors });
      const data = validation.data;

      const jar = await mongoDb.getTipJarById(data.jarId);
      if (!jar) return res.status(404).json({ error: 'Tip jar not found' });
      if (jar.status !== 'active') return res.status(400).json({ error: 'Tip jar is not active' });

      const tipId = `tip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      const tip: any = {
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

      const amount = parseFloat(String(data.amount));
      await mongoDb.updateTipJar(data.jarId, {
        totalTipsReceived: (jar.totalTipsReceived || 0) + amount,
        tipCount: (jar.tipCount || 0) + 1,
        updatedAt: now,
      });

      return res.status(201).json(tip);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Tips POST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH update tip jar status
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { jarId, status } = req.query;
    if (!jarId || !status || typeof jarId !== 'string' || typeof status !== 'string') {
      return res.status(400).json({ error: 'Missing jarId or status' });
    }
    const validStatuses: TipJarStatus[] = ['active', 'paused', 'closed'];
    if (!validStatuses.includes(status as TipJarStatus)) return res.status(400).json({ error: 'Invalid status' });

    const updated = await mongoDb.updateTipJar(jarId, { status: status as TipJarStatus, updatedAt: new Date().toISOString() });
    if (!updated) return res.status(404).json({ error: 'Tip jar not found' });
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Tips PATCH error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
