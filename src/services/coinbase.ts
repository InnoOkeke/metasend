import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

import { COINBASE_APP_ID, COINBASE_OAUTH_CLIENT_ID, COINBASE_OAUTH_SCOPES, getCoinbaseRedirectUri } from "../config/coinbase";

export const SESSION_STORAGE_KEY = "metasend.coinbase.session";

const COINBASE_API_BASE_URL = "https://api.coinbase.com";
const COINBASE_API_VERSION = "2024-05-15";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://www.coinbase.com/oauth/authorize",
  tokenEndpoint: "https://api.coinbase.com/oauth/token",
  revocationEndpoint: "https://api.coinbase.com/oauth/revoke",
};

export type CoinbaseSignInStrategy = "email" | "social";

export type EmbeddedWalletProfile = {
  userId: string;
  email: string;
  walletAddress: string;
  displayName?: string;
  photoUrl?: string;
};

export type CoinbaseSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
};

export type CoinbaseSessionPayload = {
  session: CoinbaseSession;
  profile: EmbeddedWalletProfile;
};

export type StartSessionInput = {
  refreshToken?: string;
  strategy?: CoinbaseSignInStrategy;
};

export async function startEmbeddedWalletSession(
  input: StartSessionInput = {}
): Promise<CoinbaseSessionPayload> {
  if (input.refreshToken) {
    return refreshCoinbaseSession(input.refreshToken);
  }
  return authenticateWithCoinbase(input.strategy ?? "email");
}

export async function persistSession(session: CoinbaseSession, profile: EmbeddedWalletProfile): Promise<void> {
  await SecureStore.setItemAsync(
    SESSION_STORAGE_KEY,
    JSON.stringify({ session, profile } satisfies CoinbaseSessionPayload)
  );
}

export async function loadCachedSession(): Promise<CoinbaseSessionPayload | null> {
  const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CoinbaseSessionPayload;
    return parsed;
  } catch (err) {
    console.warn("Failed to parse cached Coinbase session", err);
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function removeCachedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

export async function revokeCoinbaseSession(session: CoinbaseSession): Promise<void> {
  if (!session.refreshToken) return;
  if (!COINBASE_OAUTH_CLIENT_ID) return;
  try {
    await AuthSession.revokeAsync(
      {
        clientId: COINBASE_OAUTH_CLIENT_ID,
        token: session.refreshToken,
      },
      discovery
    );
  } catch (err) {
    console.warn("Failed to revoke Coinbase session", err);
  }
}

async function authenticateWithCoinbase(strategy: CoinbaseSignInStrategy): Promise<CoinbaseSessionPayload> {
  if (!COINBASE_OAUTH_CLIENT_ID) {
    throw new Error("Coinbase OAuth client ID missing. Set expo.extra.coinbaseOAuthClientId in app config.");
  }

  const redirectUri = getCoinbaseRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: COINBASE_OAUTH_CLIENT_ID,
    redirectUri,
    scopes: [...COINBASE_OAUTH_SCOPES],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: buildAuthParams(strategy),
  });

  const result = await request.promptAsync(discovery, {
    preferEphemeralSession: strategy === "social",
  });

  if (result.type !== "success" || !result.params.code) {
    throw new Error(result.type === "dismiss" ? "Sign-in cancelled." : "Coinbase sign-in failed.");
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: COINBASE_OAUTH_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier ?? "",
      },
    },
    discovery
  );

  const session = tokenResponseToSession(tokenResponse);
  const profile = await fetchCoinbaseProfile(session);
  return { session, profile } satisfies CoinbaseSessionPayload;
}

async function refreshCoinbaseSession(refreshToken: string): Promise<CoinbaseSessionPayload> {
  if (!COINBASE_OAUTH_CLIENT_ID) {
    throw new Error("Coinbase OAuth client ID missing. Set expo.extra.coinbaseOAuthClientId in app config.");
  }

  const tokenResponse = await AuthSession.refreshAsync(
    {
      clientId: COINBASE_OAUTH_CLIENT_ID,
      refreshToken,
      scopes: [...COINBASE_OAUTH_SCOPES],
    },
    discovery
  );

  const session = tokenResponseToSession(tokenResponse, refreshToken);
  const profile = await fetchCoinbaseProfile(session);
  return { session, profile } satisfies CoinbaseSessionPayload;
}

function tokenResponseToSession(
  tokenResponse: AuthSession.TokenResponse,
  fallbackRefreshToken?: string
): CoinbaseSession {
  const expiresInMs = (tokenResponse.expiresIn ?? 0) * 1000;
  const expiresAt = Date.now() + expiresInMs;
  return {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? fallbackRefreshToken,
    expiresAt,
    tokenType: tokenResponse.tokenType ?? "Bearer",
    scope: tokenResponse.scope,
  } satisfies CoinbaseSession;
}

function buildAuthParams(strategy: CoinbaseSignInStrategy) {
  const baseParams: Record<string, string> = {
    account: "all",
    state: `${COINBASE_APP_ID}:${Date.now()}`,
    access_type: "offline",
  };

  if (strategy === "social") {
    return {
      ...baseParams,
      prompt: "select_account",
    };
  }

  return {
    ...baseParams,
  };
}

async function fetchCoinbaseProfile(session: CoinbaseSession): Promise<EmbeddedWalletProfile> {
  const headers = buildAuthHeaders(session);

  const userRes = await fetch(`${COINBASE_API_BASE_URL}/v2/user`, { headers });
  if (!userRes.ok) {
    throw new Error("Failed to fetch Coinbase user profile.");
  }
  const userJson = (await userRes.json()) as CoinbaseUserResponse;
  const user = userJson.data;

  const walletAddress = await resolveBaseUsdcAddress(headers).catch((err) => {
    console.warn("Failed to resolve Base USDC address", err);
    return "";
  });

  return {
    userId: user?.id ?? "",
    email: user?.email ?? "",
    walletAddress: walletAddress ?? "",
    displayName: user?.name ?? user?.username ?? user?.email ?? undefined,
    photoUrl: user?.avatar_url ?? undefined,
  } satisfies EmbeddedWalletProfile;
}

async function resolveBaseUsdcAddress(headers: Record<string, string>): Promise<string> {
  const accountsRes = await fetch(`${COINBASE_API_BASE_URL}/v2/accounts?limit=50`, { headers });
  if (!accountsRes.ok) {
    return "";
  }
  const accountsJson = (await accountsRes.json()) as CoinbaseAccountsResponse;
  const usdcAccount = accountsJson.data.find((account) => account.currency === "USDC");
  if (!usdcAccount) {
    return "";
  }

  const addressesRes = await fetch(
    `${COINBASE_API_BASE_URL}/v2/accounts/${usdcAccount.id}/addresses?limit=1&network=base`,
    { headers }
  );
  if (!addressesRes.ok) {
    return "";
  }
  const addressesJson = (await addressesRes.json()) as CoinbaseAddressesResponse;
  return addressesJson.data?.[0]?.address ?? "";
}

function buildAuthHeaders(session: CoinbaseSession): Record<string, string> {
  return {
    Authorization: `${session.tokenType ?? "Bearer"} ${session.accessToken}`,
    "CB-VERSION": COINBASE_API_VERSION,
    Accept: "application/json",
  };
}

type CoinbaseUserResponse = {
  data: {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    avatar_url?: string;
  };
};

type CoinbaseAccountsResponse = {
  data: Array<{
    id: string;
    name?: string;
    currency: string;
  }>;
};

type CoinbaseAddressesResponse = {
  data: Array<{
    address: string;
  }>;
};
