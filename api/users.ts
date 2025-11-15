import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase } from '../src/services/database';
import { User } from '../src/types/database';

const authorize = (req: VercelRequest): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.METASEND_API_KEY}`;
};

const badRequest = (res: VercelResponse, message: string) => res.status(400).json({ success: false, error: message });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorize(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const db = await getDatabase();

    if (req.method === 'GET') {
      const { email, userId, search, limit } = req.query;

      if (search && typeof search === 'string') {
        const users = await db.searchUsersByEmail(search, limit ? Number(limit) : 10);
        return res.status(200).json({ success: true, users });
      }

      if (email && typeof email === 'string') {
        const user = await db.getUserByEmail(email);
        return res.status(200).json({ success: true, user });
      }

      if (userId && typeof userId === 'string') {
        const user = await db.getUserById(userId);
        return res.status(200).json({ success: true, user });
      }

      return badRequest(res, 'Provide email, userId, or search query');
    }

    if (req.method === 'POST') {
      const { userId, email, emailVerified, walletAddress, displayName, avatar } = req.body as Partial<User> & {
        walletAddress?: string;
        displayName?: string;
        avatar?: string;
      };

      if (!userId || !email) {
        return badRequest(res, 'userId and email are required');
      }

      const existing = await db.getUserByEmail(email);
      const now = new Date().toISOString();

      if (existing) {
        const updated = await db.updateUser(existing.userId, {
          emailVerified: emailVerified ?? existing.emailVerified,
          wallets: {
            ...existing.wallets,
            evm: walletAddress ?? existing.wallets.evm,
          },
          profile: {
            ...existing.profile,
            displayName: displayName ?? existing.profile.displayName,
            avatar: avatar ?? existing.profile.avatar,
          },
          lastLoginAt: now,
        });

        return res.status(200).json({ success: true, user: updated });
      }

      const user: User = {
        userId,
        email,
        emailVerified: emailVerified ?? true,
        wallets: {
          evm: walletAddress,
        },
        profile: {
          displayName,
          avatar,
        },
        createdAt: now,
        lastLoginAt: now,
      };

      await db.createUser(user);
      return res.status(201).json({ success: true, user });
    }

    if (req.method === 'PATCH') {
      const { userId, updates } = req.body as { userId?: string; updates?: Partial<User> };
      if (!userId || !updates) {
        return badRequest(res, 'userId and updates are required');
      }

      const updated = await db.updateUser(userId, updates);
      return res.status(200).json({ success: true, user: updated });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ User API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
