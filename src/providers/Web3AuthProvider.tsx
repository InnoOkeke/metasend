import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Web3Auth, { type IWeb3Auth } from "@web3auth/react-native-sdk";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
// import { ChainNamespace } from "@web3auth/base";
import * as WebBrowser from "@toruslabs/react-native-web-browser";
import * as SecureStore from "expo-secure-store";
import { type Address, type Hex, type PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { registerUser, autoClaimPendingTransfers } from "../services/api";
import { smartWalletService } from "../services/smartWalletService";
import Constants from "expo-constants";
// Ensure randomBytes available on browserCrypto at module load time
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cryptoShim = require('../crypto-polyfill').default || require('../crypto-polyfill');
    if (!(global as any).browserCrypto) {
        (global as any).browserCrypto = (global as any).crypto || cryptoShim;
    }
    if (!(global as any).browserCrypto.randomBytes && cryptoShim?.randomBytes) {
        (global as any).browserCrypto.randomBytes = cryptoShim.randomBytes;
    }
} catch (e) {
    // ignore if shim not available
}

const SCHEME = "metasend";

// Securely read Web3Auth Client ID from environment
const getWeb3AuthClientId = () => {
    const clientId = Constants?.expoConfig?.extra?.web3AuthClientId;
    if (!clientId) {
        console.error("⚠️ WEB3AUTH_CLIENT_ID not found in environment variables");
        throw new Error("Web3Auth Client ID is required. Please set WEB3AUTH_CLIENT_ID in your .env file.");
    }
    return clientId;
};

export type AuthProvider = "google" | "apple" | "email_passwordless";

export type UserProfile = {
    userId: string;
    email: string;
    walletAddress: string;
    displayName?: string;
    photoUrl?: string;
    username?: string;
};

export type AuthContextValue = {
    walletAddress: string | null;
    profile: UserProfile | null;
    isConnected: boolean;
    loading: boolean;
    login: (provider: AuthProvider, email?: string) => Promise<void>;
    logout: () => Promise<void>;
    error: string | null;
    sendUserOperation: (calls: any[]) => Promise<{ userOperationHash: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const chainConfig = {
    chainNamespace: "eip155" as any, // Use string literal
    chainId: "0x14a34", // Base Sepolia (84532)
    rpcTarget: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    displayName: "Base Sepolia",
    blockExplorerUrl: "https://sepolia.basescan.org",
    ticker: "ETH",
    tickerName: "Ethereum",
};

export const Web3AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [web3auth, setWeb3auth] = useState<IWeb3Auth | null>(null);
    const [loading, setLoading] = useState(true); // Start as true until init completes
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [smartAccountClient, setSmartAccountClient] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                console.log("🔄 Starting Web3Auth initialization...");
                // Debug: log browserCrypto availability
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    console.log("debug browserCrypto:", typeof (global as any).browserCrypto, "hasRandomBytes:", typeof (global as any).browserCrypto?.randomBytes);
                } catch (logErr) {
                    console.warn("Could not read browserCrypto:", logErr);
                }
                const clientId = getWeb3AuthClientId();
                console.log("🆔 Client ID retrieved");

                console.log("🔧 Initializing EthereumPrivateKeyProvider...");
                const privateKeyProvider = new EthereumPrivateKeyProvider({
                    config: { chainConfig },
                });
                console.log("✅ EthereumPrivateKeyProvider initialized");

                console.log("🔧 Initializing Web3Auth...");
                const w3a = new Web3Auth(WebBrowser, SecureStore, {
                    clientId,
                    network: "sapphire_devnet" as any,
                    redirectUrl: `${SCHEME}://auth`,
                    privateKeyProvider,
                });

                await w3a.init();
                console.log("✅ Web3Auth.init() completed");

                setWeb3auth(w3a);

                // Check if user is already logged in
                if (w3a.connected) {
                    console.log("🔓 User already connected, handling login success...");
                    await handleLoginSuccess(w3a);
                } else {
                    console.log("🔒 User not connected");
                }
            } catch (e) {
                console.error("❌ Web3Auth init error:", e);
                setError("Failed to initialize Web3Auth. Please restart the app.");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleLoginSuccess = async (w3a: IWeb3Auth) => {
        try {
            setLoading(true);
            setError(null);

            if (!w3a.provider) throw new Error("Web3Auth provider not available");

            const privKey = await w3a.provider.request({ method: "eth_private_key" }) as string;
            if (!privKey) throw new Error("No private key found");

            console.log("📦 Creating Coinbase Smart Wallet from Web3Auth...");

            // 1. Create EOA from Web3Auth private key
            // Web3Auth returns key without 0x prefix, but viem requires it
            const formattedKey = privKey.startsWith('0x') ? privKey : `0x${privKey}`;
            const eoaAccount = privateKeyToAccount(formattedKey as Hex);
            console.log("🔑 EOA Owner:", eoaAccount.address);

            // 2. Create Smart Account from EOA
            const smartClient = await smartWalletService.createSmartAccount(eoaAccount);
            const smartWalletAddress = smartClient.account.address;
            console.log("✨ Smart Wallet Address:", smartWalletAddress);

            // Store smart account client for transactions
            setSmartAccountClient(smartClient);

            // 3. Get user info from Web3Auth
            const userInfo = await w3a.userInfo();
            if (!userInfo) throw new Error("No user info found");

            const email = userInfo.email || `user-${eoaAccount.address.slice(0, 6)}@metasend.io`;
            const userId = userInfo.verifierId || eoaAccount.address;

            // Extract username from name or email
            const username = userInfo.name || email.split('@')[0];

            // 4. Register user with backend
            const directoryProfile = await registerUser({
                userId,
                email,
                emailVerified: true,
                walletAddress: smartWalletAddress,
                displayName: userInfo.name || email.split('@')[0],
                photoUrl: userInfo.profileImage,
            });

            const userProfile: UserProfile = {
                userId: directoryProfile.userId,
                email: directoryProfile.email,
                walletAddress: directoryProfile.wallets.base || smartWalletAddress,
                displayName: directoryProfile.profile.displayName,
                photoUrl: directoryProfile.profile.avatar,
                username: username,
            };

            setProfile(userProfile);
            setIsConnected(true);

            console.log("✅ Smart Wallet ready with Coinbase Paymaster!");

            // Auto-claim pending transfers
            autoClaimPendingTransfers(userProfile.userId, userProfile.email).catch(console.warn);

        } catch (err) {
            console.error("❌ Wallet setup failed:", err);
            setError(err instanceof Error ? err.message : "Failed to setup wallet");
            setProfile(null);
            setIsConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const login = async (provider: AuthProvider, email?: string) => {
        try {
            setLoading(true);
            setError(null);
            if (!web3auth) throw new Error("Web3Auth not initialized");

            if (provider === "email_passwordless") {
                if (!email) throw new Error("Email required for passwordless login");
                await web3auth.login({
                    loginProvider: "email_passwordless",
                    extraLoginOptions: { login_hint: email },
                });
            } else {
                await web3auth.login({
                    loginProvider: provider,
                });
            }

            if (web3auth.connected) {
                await handleLoginSuccess(web3auth);
            }
        } catch (err) {
            console.error("Login error:", err);
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            if (web3auth) {
                await web3auth.logout();
            }
            setProfile(null);
            setIsConnected(false);
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Smart wallet transaction sender with Coinbase paymaster
    const sendUserOperation = async (calls: any[]): Promise<{ userOperationHash: string }> => {
        if (!smartAccountClient || !profile?.walletAddress) {
            throw new Error("Smart wallet not initialized");
        }

        try {
            console.log("🚀 Sending gasless transaction with Coinbase paymaster");

            const txHash = await smartWalletService.sendUserOperation(smartAccountClient, calls);

            return { userOperationHash: txHash };
        } catch (error) {
            console.error("❌ Transaction failed:", error);
            throw error;
        }
    };

    const value = useMemo(() => ({
        walletAddress: profile?.walletAddress || null,
        profile,
        isConnected,
        loading,
        login,
        logout,
        error,
        sendUserOperation
    }), [profile, isConnected, loading, error]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within Web3AuthProvider");
    return context;
};
