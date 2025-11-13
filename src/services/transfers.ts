import { resolveEmailToWallet } from "./addressResolution";
import { CoinbaseSession, EmbeddedWalletProfile } from "./coinbase";
import { sendEmail } from "./notifications";
import { PaymasterRequest, sponsorTransaction, SponsoredTransaction } from "./paymaster";
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
  recipientWallet?: string;
};

const transferHistory: TransferRecord[] = [];

export async function listTransfers(senderWallet: string): Promise<TransferRecord[]> {
  await delay(200);
  return transferHistory.filter((record) => record.senderWallet === senderWallet);
}

export async function sendUsdcWithPaymaster(
  profile: EmbeddedWalletProfile,
  session: CoinbaseSession,
  intent: TransferIntent,
  sponsorFn: (request: PaymasterRequest) => Promise<SponsoredTransaction> = sponsorTransaction
): Promise<TransferResult> {
  const { recipientEmail, amountUsdc, memo } = intent;

  if (amountUsdc <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const senderAddress = assertHexAddress(profile.walletAddress, "Sender wallet");
  const contact = await resolveEmailToWallet({ email: recipientEmail });

  if (!contact.isRegistered || !contact.walletAddress) {
    const pendingRecord = await enqueuePendingTransfer(senderAddress, intent);
    return pendingRecord;
  }

  const recipientAddress = assertHexAddress(contact.walletAddress, "Recipient wallet");

  const estimatedUserOp = buildTransferUserOp({
    sender: senderAddress,
    recipient: recipientAddress,
    amountUsdc,
    memo,
  });

  const sponsorship = await sponsorFn(estimatedUserOp);

  const txHash = sponsorship.userOpHash;

  const record: TransferRecord = {
    id: `tx_${Date.now()}`,
    createdAt: new Date().toISOString(),
  senderWallet: profile.walletAddress,
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

const buildTransferUserOp = ({
  sender,
  recipient,
  amountUsdc,
  memo,
}: {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  amountUsdc: number;
  memo?: string;
}): PaymasterRequest => {
  const amountScaled = BigInt(Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)));
  const data = encodeErc20Transfer(recipient, amountScaled, memo);
  return {
    chainId: BASE_CHAIN_ID,
    sender,
    target: USDC_TOKEN_ADDRESS,
    data,
  } satisfies PaymasterRequest;
};

const encodeErc20Transfer = (
  recipient: `0x${string}`,
  amount: bigint,
  memo?: string
): `0x${string}` => {
  const methodId = "a9059cbb"; // transfer(address,uint256)
  const recipientPadded = recipient.replace("0x", "").padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  const baseCallData = `0x${methodId}${recipientPadded}${amountHex}` as `0x${string}`;
  if (!memo) return baseCallData;
  const memoHex = stringToHex(memo);
  return (`${baseCallData}${memoHex}` as string).slice(0, 2 + 8 + 64 + 64 + memoHex.length) as `0x${string}`;
};

const stringToHex = (value: string): string =>
  Array.from(value)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");

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
