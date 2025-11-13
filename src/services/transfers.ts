import { resolveEmailToWallet } from "./addressResolution";
import { sendEmail } from "./notifications";
import { getUsdcBalance, encodeUsdcTransfer } from "./blockchain";
import { BASE_CHAIN_ID, USDC_TOKEN_ADDRESS, USDC_DECIMALS } from "../config/coinbase";

export type TransferIntent = {
  recipientEmail: string;
  amountUsdc: number;
  memo?: string;
};

export type TransferResult = {
  intent: TransferIntent;
  status: "sent" | "pending_recipient_signup";
  txHash?: `0x${string}`;
  redemptionCode?: string;
  recipientWallet?: string;
};

export type TransferRecord = TransferResult & {
  id: string;
  createdAt: string;
  senderWallet: string;
};

const transferHistory: TransferRecord[] = [];

export async function listTransfers(senderWallet: string): Promise<TransferRecord[]> {
  await delay(200);
  return transferHistory.filter((record) => record.senderWallet === senderWallet);
}

export async function sendUsdcWithPaymaster(
  walletAddress: `0x${string}`,
  intent: TransferIntent,
  sendUserOperationFn: (calls: any[]) => Promise<{ userOperationHash: string }>
): Promise<TransferResult> {
  const { recipientEmail, amountUsdc, memo } = intent;

  if (amountUsdc <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  // Check USDC balance before proceeding
  const balance = await getUsdcBalance(walletAddress);
  if (balance < amountUsdc) {
    throw new Error(`Insufficient USDC balance. You have ${balance.toFixed(2)} USDC but need ${amountUsdc.toFixed(2)} USDC`);
  }

  const senderAddress = assertHexAddress(walletAddress, "Sender wallet");
  const contact = await resolveEmailToWallet({ email: recipientEmail });

  if (!contact.isRegistered || !contact.walletAddress) {
    const pendingRecord = await enqueuePendingTransfer(senderAddress, intent);
    return pendingRecord;
  }

  const recipientAddress = assertHexAddress(contact.walletAddress, "Recipient wallet");

  // Encode USDC transfer call
  const transferCallData = encodeUsdcTransfer(recipientAddress, amountUsdc);

  // Execute the user operation via CDP
  const result = await sendUserOperationFn([
    {
      to: USDC_TOKEN_ADDRESS,
      value: 0n,
      data: transferCallData,
    },
  ]);

  const txHash = result.userOperationHash as `0x${string}`;

  const record: TransferRecord = {
    id: `tx_${Date.now()}`,
    createdAt: new Date().toISOString(),
    senderWallet: walletAddress,
    intent,
    status: "sent",
    txHash,
    recipientWallet: contact.walletAddress,
  };

  transferHistory.unshift(record);
  return record;
}

async function enqueuePendingTransfer(
  senderAddress: `0x${string}`,
  intent: TransferIntent
): Promise<TransferResult> {
  const redemptionCode = generateRedemptionCode();
  const record: TransferRecord = {
    id: `pending_${Date.now()}`,
    createdAt: new Date().toISOString(),
    senderWallet: senderAddress,
    intent,
    status: "pending_recipient_signup",
    redemptionCode,
  };

  transferHistory.unshift(record);

  await sendEmail({
    to: intent.recipientEmail,
    subject: "You have USDC waiting on MetaSend",
    body: `You've been sent ${intent.amountUsdc} USDC. Create a MetaSend account to claim it. Redemption code: ${redemptionCode}.`,
  });

  return record;
}

const generateRedemptionCode = () =>
  Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase();

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const assertHexAddress = (value: string | undefined | null, label: string): `0x${string}` => {
  if (!value || !value.startsWith("0x")) {
    throw new Error(`${label} must be a valid 0x-prefixed Base wallet.`);
  }
  return value as `0x${string}`;
};
