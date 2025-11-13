/**
 * Real blockchain operations for Base Sepolia
 * Uses viem for reading blockchain state and CDP hooks for transactions
 */

import { createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC_TOKEN_ADDRESS, USDC_DECIMALS, BASE_RPC_URL } from "../config/coinbase";

// ERC-20 ABI (minimal - just what we need)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

export type BlockchainTransaction = {
  hash: string;
  from: string;
  to: string;
  value: number; // in USDC
  timestamp: number;
  blockNumber: bigint;
  type: "sent" | "received";
};

// Create public client for reading blockchain state
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_RPC_URL),
});

/**
 * Get USDC balance for an address
 * @param address Wallet address to check
 * @returns Balance in USDC (as decimal number, e.g., 10.50)
 */
export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  try {
    const balance = await publicClient.readContract({
      address: USDC_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    // Convert from smallest unit to USDC (divide by 10^6)
    const balanceInUsdc = Number(balance) / Math.pow(10, USDC_DECIMALS);
    return balanceInUsdc;
  } catch (error) {
    console.error("Failed to fetch USDC balance:", error);
    throw new Error("Failed to fetch balance from blockchain");
  }
}

/**
 * Encode a USDC transfer call for use in a user operation
 * @param to Recipient address
 * @param amountUsdc Amount in USDC (e.g., 10.50)
 * @returns Encoded call data
 */
export function encodeUsdcTransfer(
  to: `0x${string}`,
  amountUsdc: number
): `0x${string}` {
  // Convert USDC to smallest unit (multiply by 10^6)
  const amountInSmallestUnit = parseUnits(amountUsdc.toString(), USDC_DECIMALS);

  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amountInSmallestUnit],
  });
}

/**
 * Get ETH balance for an address (needed for gas, even though paymaster covers it)
 */
export async function getEthBalance(address: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.getBalance({ address });
    return (Number(balance) / 1e18).toFixed(6);
  } catch (error) {
    console.error("Failed to fetch ETH balance:", error);
    return "0";
  }
}

/**
 * Get USDC transaction history for an address
 * Fetches Transfer events from the USDC contract
 * @param address Wallet address
 * @param limit Maximum number of transactions to return
 * @returns Array of blockchain transactions
 */
export async function getUsdcTransactions(
  address: `0x${string}`,
  limit: number = 50
): Promise<BlockchainTransaction[]> {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    
    // Fetch last ~10000 blocks (approximately 1 day on Base)
    const fromBlock = currentBlock - 10000n;

    // Get sent transactions (from address)
    const sentLogs = await publicClient.getLogs({
      address: USDC_TOKEN_ADDRESS,
      event: ERC20_ABI[2], // Transfer event
      args: {
        from: address,
      },
      fromBlock,
      toBlock: currentBlock,
    });

    // Get received transactions (to address)
    const receivedLogs = await publicClient.getLogs({
      address: USDC_TOKEN_ADDRESS,
      event: ERC20_ABI[2], // Transfer event
      args: {
        to: address,
      },
      fromBlock,
      toBlock: currentBlock,
    });

    // Process sent transactions
    const sentTxs: BlockchainTransaction[] = await Promise.all(
      sentLogs.map(async (log) => {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        return {
          hash: log.transactionHash,
          from: log.args.from!,
          to: log.args.to!,
          value: Number(log.args.value!) / Math.pow(10, USDC_DECIMALS),
          timestamp: Number(block.timestamp) * 1000,
          blockNumber: log.blockNumber,
          type: "sent" as const,
        };
      })
    );

    // Process received transactions
    const receivedTxs: BlockchainTransaction[] = await Promise.all(
      receivedLogs.map(async (log) => {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        return {
          hash: log.transactionHash,
          from: log.args.from!,
          to: log.args.to!,
          value: Number(log.args.value!) / Math.pow(10, USDC_DECIMALS),
          timestamp: Number(block.timestamp) * 1000,
          blockNumber: log.blockNumber,
          type: "received" as const,
        };
      })
    );

    // Combine and sort by timestamp (newest first)
    const allTxs = [...sentTxs, ...receivedTxs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return allTxs;
  } catch (error) {
    console.error("Failed to fetch USDC transactions:", error);
    return [];
  }
}
