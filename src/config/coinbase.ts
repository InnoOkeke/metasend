import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";

type ExpoExtra = {
  coinbaseAppId?: string;
  coinbaseOAuthClientId?: string;
  coinbaseRedirectScheme?: string;
  coinbaseApiKey?: string;
  coinbaseApiSecret?: string;
  coinbasePaymasterApiKey?: string;
};

const extra = (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;

// Prioritize environment variables, fallback to expo config
export const COINBASE_APP_ID = extra.coinbaseAppId ?? "162ddeb1-c67e-43fa-b38b-78a916eb7cde";
export const COINBASE_OAUTH_CLIENT_ID = extra.coinbaseOAuthClientId ?? "";
export const COINBASE_REDIRECT_SCHEME = extra.coinbaseRedirectScheme ?? "metasend";
export const COINBASE_API_KEY = extra.coinbaseApiKey ?? "";
export const COINBASE_API_SECRET = extra.coinbaseApiSecret ?? "";
export const COINBASE_PAYMASTER_API_KEY = extra.coinbasePaymasterApiKey ?? "";

// Base Network Constants - Using Sepolia Testnet
export const BASE_CHAIN_ID = 84532; // Base Sepolia Testnet
export const BASE_RPC_URL = "https://sepolia.base.org";
export const USDC_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const; // USDC on Base Sepolia
export const USDC_DECIMALS = 6;

// Coinbase Paymaster API
export const PAYMASTER_API_URL = "https://api.developer.coinbase.com/rpc/v1/base-sepolia";


export const COINBASE_OAUTH_SCOPES = [
  "wallet:user:read",
  "wallet:accounts:read",
  "wallet:addresses:read",
] as const;

export const getCoinbaseRedirectUri = () =>
  makeRedirectUri({ scheme: COINBASE_REDIRECT_SCHEME, preferLocalhost: false, isTripleSlashed: true });
