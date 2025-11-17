import { z } from "zod";
import { userDirectoryService } from "./UserDirectoryService";

export const EmailLookupSchema = z.object({
  email: z.string().email(),
});

export type EmailLookupRequest = z.infer<typeof EmailLookupSchema>;

export type EmailLookupResult = {
  email: string;
  isRegistered: boolean;
  walletAddress?: string;
  displayName?: string;
  avatar?: string;
};

/**
 * Resolve email to wallet address
 * Now powered by UserDirectoryService
 */
export async function resolveEmailToWallet({ email }: EmailLookupRequest): Promise<EmailLookupResult> {
  EmailLookupSchema.parse({ email });
  await delay();

  // Normalize email to lowercase for consistent lookups
  const normalizedEmail = email.toLowerCase().trim();
  const user = await userDirectoryService.findUserByEmail(normalizedEmail);
  
  if (!user) {
    return {
      email,
      isRegistered: false,
    } satisfies EmailLookupResult;
  }

  return {
    email: normalizedEmail,
    isRegistered: true,
    walletAddress: user.wallets.evm || user.wallets.solana || user.wallets.tron,
    displayName: user.displayName,
    avatar: user.avatar,
  } satisfies EmailLookupResult;
}

const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
