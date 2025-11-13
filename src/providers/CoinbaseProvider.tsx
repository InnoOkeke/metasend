import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useIsSignedIn, useSignOut, CDPContext } from "@coinbase/cdp-hooks";

import { userDirectoryService } from "../services/UserDirectoryService";
import { pendingTransferService } from "../services/PendingTransferService";

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
        evmAccounts: currentUser.evmAccounts,
        authMethods: currentUser.authenticationMethods,
      });
      
      // Get the first EVM smart account or EOA address
      const walletAddress = currentUser.evmSmartAccounts?.[0] || currentUser.evmAccounts?.[0];
      if (!walletAddress) {
        console.log("⚠️ No wallet address found for user");
        setProfile(null);
        return;
      }
      
      console.log("💼 Wallet address found:", walletAddress);
      
      try {
        setLoading(true);
        setError(null);
        
        const userId = currentUser.userId;
        // Get email from any auth method (email, google, apple, x)
        const authMethods = currentUser.authenticationMethods;
        const email = 
          authMethods.email?.email || 
          authMethods.google?.email || 
          authMethods.apple?.email ||
          authMethods.x?.email ||
          `${walletAddress.slice(0, 8)}@wallet.metasend.io`;
        
        const displayName = email.split('@')[0] || `User ${walletAddress.slice(0, 6)}`;
        
        // Set profile immediately (photoUrl not available from OAuth2Authentication)
        const userProfile = {
          userId,
          email,
          walletAddress,
          displayName,
          photoUrl: undefined,
        };
        
        console.log("✅ Setting profile:", userProfile);
        setProfile(userProfile);
        
        // Register user in directory if new
        const existingUser = await userDirectoryService.findUserByEmail(email);
        if (!existingUser) {
          console.log("📝 Registering new user in directory");
          await userDirectoryService.registerUser({
            userId,
            email,
            emailVerified: true,
            walletAddress,
            displayName,
          });
          
          // Auto-claim any pending transfers for this email
          const claimed = await pendingTransferService.autoClaimForNewUser(userId, email);
          if (claimed > 0) {
            console.log(`✅ Auto-claimed ${claimed} pending transfer(s)`);
          }
        } else {
          console.log("👋 Existing user, updating last login");
          // Update last login
          await userDirectoryService.updateLastLogin(existingUser.userId);
        }
      } catch (err) {
        console.error("❌ Error handling user sign in:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize wallet");
      } finally {
        setLoading(false);
      }
    };

    handleUserSignedIn();
  }, [isSignedIn, currentUser]);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      await signOut();
      setProfile(null);
    } catch (err) {
      console.warn("Failed to sign out", err);
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  const walletAddress = currentUser?.evmSmartAccounts?.[0] || currentUser?.evmAccounts?.[0] || null;

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
