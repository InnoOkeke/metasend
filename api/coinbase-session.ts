import express from 'express';

/**
 * Coinbase Onramp session proxy
 * Expects POST { walletAddress }
 * Requires Authorization: Bearer <METASEND_API_KEY>
 * Returns { sessionToken }
 */
export default async function handler(req: express.Request, res: express.Response) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const auth = req.headers.authorization;
    const expected = process.env.METASEND_API_KEY;
    if (!expected) {
      return res.status(500).json({ error: "Server misconfigured: METASEND_API_KEY missing" });
    }

    if (!auth || !auth.startsWith("Bearer ") || auth.split(" ")[1] !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { walletAddress } = req.body || {};
    if (!walletAddress) {
      return res.status(400).json({ error: "Missing walletAddress in body" });
    }

    // Coinbase Onramp sessions endpoint - requires a Coinbase API key configured in env
    const coinbaseApiKey = process.env.COINBASE_ONRAMP_API_KEY || process.env.COINBASE_API_KEY;
    if (!coinbaseApiKey) {
      return res.status(500).json({ error: "Server misconfigured: COINBASE_ONRAMP_API_KEY missing" });
    }

    const appId = process.env.COINBASE_APP_ID || (req.headers['x-app-id'] as string) || "";

    const body = {
      appId,
      walletAddress,
      // include origin so Coinbase can validate redirect/initialization
      origin: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://metasend.vercel.app",
    };

    const resp = await fetch("https://api.coinbase.com/onramp/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${coinbaseApiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      console.error("Coinbase session creation failed:", resp.status, data);
      return res.status(502).json({ error: "Failed to create coinbase session", details: data });
    }

    // Coinbase may return several shapes; try common keys
    const sessionToken = data?.sessionToken || data?.id || data?.clientSecret || data?.token || null;

    if (!sessionToken) {
      return res.status(502).json({ error: "Coinbase did not return a session token", details: data });
    }

    return res.status(200).json({ sessionToken });
  } catch (error) {
    console.error("coinbase-session error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
