import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  CoinbaseSession,
  EmbeddedWalletProfile,
  CoinbaseSignInStrategy,
  persistSession,
  loadCachedSession,
  removeCachedSession,
  revokeCoinbaseSession,
  startEmbeddedWalletSession,
} from "../services/coinbase";
import { userDirectoryService } from "../services/UserDirectoryService";
import { pendingTransferService } from "../services/PendingTransferService";

export type CoinbaseContextValue = {
  session: CoinbaseSession | null;
  profile: EmbeddedWalletProfile | null;
  loading: boolean;
  connect: (strategy?: CoinbaseSignInStrategy) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshSession: () => Promise<void>;
  error: string | null;
};

const CoinbaseContext = createContext<CoinbaseContextValue | undefined>(undefined);

export const CoinbaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<CoinbaseSession | null>(null);
  const [profile, setProfile] = useState<EmbeddedWalletProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        const cached = await loadCachedSession();
        if (!cached) {
          setSession(null);
          setProfile(null);
          return;
        }
        setSession(cached.session);
        setProfile(cached.profile);
      } catch (err) {
        console.warn("Failed to bootstrap Coinbase session", err);
        setError("Unable to load previous session. Please sign in again.");
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, []);

  const syncSession = useCallback(async (nextSession: CoinbaseSession, nextProfile: EmbeddedWalletProfile) => {
    setSession(nextSession);
    setProfile(nextProfile);
    await persistSession(nextSession, nextProfile);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      if (session) {
        await revokeCoinbaseSession(session);
      }
      await removeCachedSession();
    } catch (err) {
      console.warn("Failed to remove stored session", err);
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (!session) return;
    if (!session.refreshToken) {
      await disconnect();
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const refreshed = await startEmbeddedWalletSession({ refreshToken: session.refreshToken });
      await syncSession(refreshed.session, refreshed.profile);
    } catch (err) {
      console.warn("Failed to refresh Coinbase session", err);
      setError("Session refresh failed. Please reconnect.");
      await disconnect();
    } finally {
      setLoading(false);
    }
  }, [session, syncSession, disconnect]);

  const connect = useCallback(async (strategy: CoinbaseSignInStrategy = "email") => {
    try {
      setLoading(true);
      setError(null);
      const { session: nextSession, profile: nextProfile } = await startEmbeddedWalletSession({ strategy });
      await syncSession(nextSession, nextProfile);
      
      // Register user in directory if new
      const existingUser = await userDirectoryService.findUserByEmail(nextProfile.email);
      if (!existingUser) {
        await userDirectoryService.registerUser({
          userId: nextProfile.userId,
          email: nextProfile.email,
          emailVerified: true,
          walletAddress: nextProfile.walletAddress,
          displayName: nextProfile.displayName,
          avatar: nextProfile.photoUrl,
        });
        
        // Auto-claim any pending transfers for this email
        const claimed = await pendingTransferService.autoClaimForNewUser(nextProfile.userId, nextProfile.email);
        if (claimed > 0) {
          console.log(`✅ Auto-claimed ${claimed} pending transfer(s)`);
        }
      } else {
        // Update last login
        await userDirectoryService.updateLastLogin(existingUser.userId);
      }
    } catch (err) {
      console.error("Coinbase connect error", err);
      setError(err instanceof Error ? err.message : "Unable to connect to Coinbase right now.");
    } finally {
      setLoading(false);
    }
  }, [syncSession]);

  const value = useMemo<CoinbaseContextValue>(
    () => ({ session, profile, loading, connect, disconnect, refreshSession, error }),
    [session, profile, loading, connect, disconnect, refreshSession, error]
  );

  return <CoinbaseContext.Provider value={value}>{children}</CoinbaseContext.Provider>;
};

export const useCoinbase = (): CoinbaseContextValue => {
  const ctx = useContext(CoinbaseContext);
  if (!ctx) {
    throw new Error("useCoinbase must be used inside a CoinbaseProvider");
  }
  return ctx;
};
