import { createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { COINBASE_PAYMASTER_API_KEY, PAYMASTER_API_URL, USDC_TOKEN_ADDRESS, BASE_CHAIN_ID } from "../config/coinbase";

export type PaymasterRequest = {
  chainId: number;
  sender: `0x${string}`;
  target: `0x${string}`;
  data: `0x${string}`;
  gasLimit?: string;
  value?: string;
};

export type SponsoredTransaction = {
  sponsorshipId: string;
  userOpHash: `0x${string}`;
  status: "pending" | "submitted" | "failed";
  paymasterAndData?: `0x${string}`;
};

export type PaymasterContextValue = {
  isSponsoring: boolean;
  lastSponsorError: string | null;
  sponsor: (request: PaymasterRequest) => Promise<SponsoredTransaction>;
};

/**
 * Coinbase Paymaster integration for gasless transactions on Base
 * Docs: https://docs.cdp.coinbase.com/paymaster/docs/welcome
 * 
 * ⚠️ IMPORTANT: This is currently using SIMULATED transactions
 * Real implementation needs:
 * 1. Check USDC balance before allowing transfer
 * 2. Use CDP SDK's sendUserOperation to submit real transactions
 * 3. Actually transfer USDC on Base Sepolia network
 * 4. Handle real errors (insufficient balance, network issues, etc.)
 */
export async function sponsorTransaction(request: PaymasterRequest): Promise<SponsoredTransaction> {
  // Validate Base Sepolia chain
  if (request.chainId !== BASE_CHAIN_ID) {
    throw new Error("Only Base Sepolia testnet is supported");
  }

  // Check for API key
  if (!COINBASE_PAYMASTER_API_KEY) {
    console.warn("⚠️  COINBASE_PAYMASTER_API_KEY not configured. Using mock sponsorship.");
    return mockSponsorTransaction(request);
  }

  try {
    // Create public client for Base Sepolia
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(PAYMASTER_API_URL, {
        fetchOptions: {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${COINBASE_PAYMASTER_API_KEY}`,
          },
        },
      }),
    });

    // Estimate gas for the transaction
    const gasEstimate = await client.estimateGas({
      account: request.sender,
      to: request.target,
      data: request.data,
      value: request.value ? BigInt(request.value) : 0n,
    });

    // Request sponsorship from Coinbase Paymaster
    // Note: This uses Coinbase's paymaster API endpoint
    const paymasterResponse = await fetch(`${PAYMASTER_API_URL}/paymaster`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${COINBASE_PAYMASTER_API_KEY}`,
      },
      body: JSON.stringify({
        method: "pm_sponsorUserOperation",
        params: [
          {
            sender: request.sender,
            callData: request.data,
            callGasLimit: gasEstimate.toString(),
            verificationGasLimit: "100000",
            preVerificationGas: "50000",
          },
          BASE_CHAIN_ID,
        ],
      }),
    });

    if (!paymasterResponse.ok) {
      throw new Error(`Paymaster API error: ${paymasterResponse.statusText}`);
    }

    const paymasterData = await paymasterResponse.json();

    // Simulate transaction submission
    const txHash = await simulateTransactionSubmission(request, paymasterData);

    return {
      sponsorshipId: paymasterData.result?.sponsorshipId ?? `sponsor_${Date.now()}`,
      userOpHash: txHash,
      status: "submitted",
      paymasterAndData: paymasterData.result?.paymasterAndData,
    } satisfies SponsoredTransaction;
  } catch (error) {
    console.error("Paymaster sponsorship failed:", error);
    throw new Error(`Failed to sponsor transaction: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Simulate transaction submission after sponsorship
 * 
 * ⚠️ TODO: Replace with real transaction submission
 * Should use CDP SDK's sendUserOperation or smart account transaction methods
 * to actually submit the UserOperation to the Base Sepolia bundler
 */
async function simulateTransactionSubmission(
  request: PaymasterRequest,
  paymasterData: any
): Promise<`0x${string}`> {
  await artificialLatency(800);
  
  // Generate a realistic transaction hash
  const timestamp = Date.now();
  const randomBytes = Math.floor(Math.random() * 1e12).toString(16);
  const txHash = `0x${timestamp.toString(16)}${randomBytes}`.padEnd(66, "0").slice(0, 66) as `0x${string}`;
  
  console.log("✅ Gasless transaction sponsored:", {
    from: request.sender,
    to: request.target,
    txHash,
    sponsored: true,
  });
  
  return txHash;
}

/**
 * Mock sponsorship for development when API key is not configured
 * 
 * ⚠️ WARNING: This does NOT execute real blockchain transactions
 * Configure COINBASE_PAYMASTER_API_KEY to enable real gasless transactions
 */
async function mockSponsorTransaction(request: PaymasterRequest): Promise<SponsoredTransaction> {
  await artificialLatency();
  const hashSuffix = Math.floor(Math.random() * 1e12).toString(16);
  
  console.log("🧪 Mock gasless transaction (configure COINBASE_PAYMASTER_API_KEY for real sponsorship)");
  
  return {
    sponsorshipId: `sponsor_mock_${hashSuffix}`,
    userOpHash: `0x${hashSuffix.padEnd(64, "0")}` as `0x${string}`,
    status: "submitted",
  } satisfies SponsoredTransaction;
}

const artificialLatency = (ms = 650) => new Promise((resolve) => setTimeout(resolve, ms));
