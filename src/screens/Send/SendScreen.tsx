import React, { useMemo, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSendUserOperation } from "@coinbase/cdp-hooks";

import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import { useCoinbase } from "../../providers/CoinbaseProvider";
import { resolveEmailToWallet } from "../../services/addressResolution";
import { sendUsdcWithPaymaster, TransferIntent, TransferResult } from "../../services/transfers";
import { getUsdcBalance } from "../../services/blockchain";
import { useTheme } from "../../providers/ThemeProvider";
import type { ColorPalette } from "../../utils/theme";
import { spacing, typography } from "../../utils/theme";

const FormSchema = z.object({
  email: z.string().email(),
  amount: z.number().gt(0, "Enter an amount greater than zero"),
  memo: z.string().max(120, "Keep memo under 120 characters").optional(),
});

type FormState = {
  email: string;
  amount: string;
  memo: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export const SendScreen: React.FC = () => {
  const { profile } = useCoinbase();
  const { sendUserOperation, status: sendStatus, error: sendError } = useSendUserOperation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ email: "", amount: "", memo: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<TransferResult | null>(null);

  // Query USDC balance
  const { data: usdcBalance, isLoading: loadingBalance } = useQuery({
    queryKey: ["usdcBalance", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return getUsdcBalance(profile.walletAddress as `0x${string}`);
    },
    enabled: Boolean(profile?.walletAddress),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Wallet not connected</Text>
          <Text style={styles.subtitle}>Please sign in with your Coinbase Smart Wallet to send USDC.</Text>
        </View>
      </View>
    );
  }

  if (!profile.walletAddress || !profile.walletAddress.startsWith("0x")) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Base wallet not ready</Text>
          <Text style={styles.subtitle}>
            Your Coinbase Smart Wallet is being created. Please wait a moment and try again.
          </Text>
        </View>
      </View>
    );
  }

  const emailIsValid = useMemo(() => z.string().email().safeParse(form.email).success, [form.email]);

  const { data: emailLookup, isFetching: resolvingEmail } = useQuery({
    queryKey: ["emailLookup", form.email.toLowerCase()],
    queryFn: () => resolveEmailToWallet({ email: form.email.toLowerCase() }),
    enabled: emailIsValid,
    staleTime: 1000 * 30,
  });

  const mutation = useMutation({
    mutationFn: async (intent: TransferIntent) => {
      if (!profile?.walletAddress) throw new Error("Wallet not connected");
      
      // Create sendUserOperation function for the transfer service
      const sendUserOpFn = async (calls: any[]) => {
        return await sendUserOperation({
          evmSmartAccount: profile.walletAddress as `0x${string}`,
          network: "base-sepolia",
          calls,
          useCdpPaymaster: true, // Use Coinbase Paymaster for gasless transactions
        });
      };
      
      return sendUsdcWithPaymaster(
        profile.walletAddress as `0x${string}`,
        intent,
        sendUserOpFn
      );
    },
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["transfers", profile?.walletAddress] });
      await queryClient.invalidateQueries({ queryKey: ["usdcBalance", profile?.walletAddress] });
      setResult(payload);
      setForm((prev) => ({ ...prev, amount: "", memo: "" }));
    },
  });

  const handleChange = (key: keyof FormState, value: string) => {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    const parsed = FormSchema.safeParse({
      email: form.email.trim().toLowerCase(),
      amount: Number(form.amount),
      memo: form.memo.trim() || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof FormState | undefined;
        if (path) fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setResult(null);

    const payload: TransferIntent = {
      recipientEmail: parsed.data.email,
      amountUsdc: parsed.data.amount,
      memo: parsed.data.memo,
    };

    mutation.mutate(payload);
  };

  const statusMessage = (() => {
    if (!result) return null;
    if (result.status === "pending_recipient_signup") {
      return `Invite sent. ${form.email} will receive an email with a redemption code once they create a MetaSend account.`;
    }
    if (result.status === "sent") {
      return `Transfer submitted on Base. Tx hash: ${result.txHash}`;
    }
    return null;
  })();

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Send USDC via email</Text>
        <Text style={styles.subtitle}>
          MetaSend resolves the recipient's wallet automatically. If they do not have an account yet, we
          email them a redemption link to claim funds after onboarding.
        </Text>

        <TextField
          label="Recipient email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={form.email}
          onChangeText={(value) => handleChange("email", value)}
          error={errors.email}
        />
        {emailLookup ? (
          <Text style={styles.lookup}>
            {emailLookup.isRegistered
              ? `Registered MetaSend user. Wallet: ${emailLookup.walletAddress}`
              : "No MetaSend account yet — transfer will queue until signup."}
          </Text>
        ) : resolvingEmail && emailIsValid ? (
          <Text style={styles.lookup}>Resolving recipient wallet…</Text>
        ) : null}

        <TextField
          label="Amount (USDC)"
          keyboardType="numeric"
          value={form.amount}
          onChangeText={(value) => handleChange("amount", value)}
          error={errors.amount}
        />
        
        {usdcBalance !== undefined && (
          <Text style={styles.balanceText}>
            Balance: {usdcBalance.toFixed(2)} USDC
          </Text>
        )}

        <TextField
          label="Memo (optional)"
          value={form.memo}
          onChangeText={(value) => handleChange("memo", value)}
          error={errors.memo}
          placeholder="Add a note for the recipient"
        />

        <PrimaryButton
          title="Review & Send"
          onPress={handleSubmit}
          loading={mutation.isPending || sendStatus === "pending"}
        />

        {mutation.error ? (
          <Text style={styles.error}>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Something went wrong while sending the transfer."}
          </Text>
        ) : null}
        {sendError ? <Text style={styles.error}>{sendError.message}</Text> : null}
        {statusMessage ? <Text style={styles.success}>{statusMessage}</Text> : null}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexGrow: 1,
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 18,
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    lookup: {
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    balanceText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    error: {
      color: colors.error,
      marginTop: spacing.sm,
    },
    success: {
      color: colors.success,
      marginTop: spacing.sm,
    },
  });
