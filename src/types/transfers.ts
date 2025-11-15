export type TransferIntent = {
  recipientEmail: string;
  amountUsdc: number;
  memo?: string;
  senderEmail?: string;
  senderName?: string;
  senderUserId?: string;
};

export type TransferResult = {
  intent: TransferIntent;
  status: "sent" | "pending_recipient_signup";
  txHash?: `0x${string}`;
  redemptionCode?: string;
  recipientWallet?: string;
  pendingTransferId?: string;
};

export type TransferRecord = TransferResult & {
  id: string;
  createdAt: string;
  senderWallet: string;
};
