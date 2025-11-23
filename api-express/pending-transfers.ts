import express from 'express';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import vercelHandler from '../api/pending-transfers';

const router = express.Router();

// Convert Express req/res to Vercel format
router.all('/', async (req, res) => {
  const vercelReq = req as unknown as VercelRequest;
  const vercelRes = res as unknown as VercelResponse;
  
  // await vercelHandler(vercelReq, vercelRes, () => {});
  res.status(501).json({ error: "Not implemented" });
});

export default router;
