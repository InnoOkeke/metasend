import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useIsSignedIn, useSignOut, CDPContext } from "@coinbase/cdp-hooks";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { registerUser } from "../services/api";
import { BIOMETRIC_AUTH_KEY, RETURNING_USER_KEY } from "../constants/auth";

export type CoinbaseProfile = {
  userId: string;
  email: string;
  walletAddress: string;
  displayName?: string;
  photoUrl?: string;
};

export type CoinbaseContextValue = {
  walletAddress: string | null;
  profile: CoinbaseProfile | null;
  isConnected: boolean;
  loading: boolean;
  disconnect: () => Promise<void>;
  error: string | null;
};

const CoinbaseContext = createContext<CoinbaseContextValue | undefined>(undefined);

export const CoinbaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const cdpContext = useContext(CDPContext);
  const { isSignedIn } = useIsSignedIn();
  const { signOut } = useSignOut();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CoinbaseProfile | null>(null);

  const currentUser = cdpContext?.currentUser;

  useEffect(() => {
    const handleUserSignedIn = async () => {
      if (!isSignedIn || !currentUser) {
        console.log("👤 No user signed in, clearing profile");
        setProfile(null);
        return;
      }

      console.log("👤 Current user:", {
        userId: currentUser.userId,
        evmSmartAccounts: currentUser.evmSmartAccounts,
        authMethods: currentUser.authenticationMethods,
      });

      const walletAddress = currentUser.evmSmartAccounts?.[0];
      if (!walletAddress) {
        console.log("⚠️ No smart account address found for user");
        setProfile(null);
        setError("Smart wallet not ready. Please retry sign in.");
        return;
      }

      const authMethods = currentUser.authenticationMethods;
      const email =
        authMethods.email?.email ||
        authMethods.google?.email ||
        authMethods.apple?.email ||
        authMethods.x?.email ||
        `${walletAddress.slice(0, 8)}@wallet.metasend.io`;

      const displayName = email.split("@")[0] || `User ${walletAddress.slice(0, 6)}`;

      try {
        setLoading(true);
        setError(null);

        const directoryProfile = await registerUser({
          userId: currentUser.userId,
          email,
          emailVerified: true,
          walletAddress,
          displayName,
        });

        const syncedProfile: CoinbaseProfile = {
          userId: directoryProfile.userId,
          email: directoryProfile.email,
          walletAddress: directoryProfile.wallets.evm || walletAddress,
          displayName: directoryProfile.profile.displayName || displayName,
          photoUrl: directoryProfile.profile.avatar,
        };

        console.log("✅ Directory synced profile:", syncedProfile);
        setProfile(syncedProfile);

        // Auto-claim removed - users claim via email link only
      } catch (err) {
        console.error("❌ Error syncing user directory:", err);
        setProfile(null);
        setError(err instanceof Error ? err.message : "Failed to sync MetaSend account");
      } finally {
        setLoading(false);
      }
    };

    handleUserSignedIn();
  }, [isSignedIn, currentUser]);

  const clearLocalAuthState = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([BIOMETRIC_AUTH_KEY, RETURNING_USER_KEY]);
    } catch (error) {
      console.warn("Failed to clear auth flags on sign out", error);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      await clearLocalAuthState();

      if (!isSignedIn) {
        console.log("ℹ️ Already signed out");
        setProfile(null);
        return;
      }

      await signOut();
      setProfile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("User is not authenticated")) {
        console.log("ℹ️ Sign out skipped: user already signed out");
        setProfile(null);
        return;
      }

      console.warn("Failed to sign out", err);
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setLoading(false);
    }
  }, [signOut, isSignedIn, clearLocalAuthState]);

  const walletAddress = currentUser?.evmSmartAccounts?.[0] || null;

  const value = useMemo<CoinbaseContextValue>(
    () => ({
      walletAddress,
      profile,
      isConnected: isSignedIn,
      loading,
      disconnect,
      error,
    }),
    [walletAddress, profile, isSignedIn, loading, disconnect, error]
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
