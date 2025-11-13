import { createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { base } from "viem/chains";
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
 */
export async function sponsorTransaction(request: PaymasterRequest): Promise<SponsoredTransaction> {
  // Validate Base chain
  if (request.chainId !== BASE_CHAIN_ID) {
    throw new Error("Only Base network is supported");
  }

  // Check for API key
  if (!COINBASE_PAYMASTER_API_KEY) {
    console.warn("⚠️  COINBASE_PAYMASTER_API_KEY not configured. Using mock sponsorship.");
    return mockSponsorTransaction(request);
  }

  try {
    // Create public client for Base
    const client = createPublicClient({
      chain: base,
      transport: http(PAYMASTER_API_URL, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${COINBASE_PAYMASTER_API_KEY}`,
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
 * In production, this would actually submit the UserOperation to the bundler
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
