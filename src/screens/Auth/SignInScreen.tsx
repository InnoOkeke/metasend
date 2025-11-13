import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../../components/PrimaryButton";
import { useCoinbase } from "../../providers/CoinbaseProvider";
import type { CoinbaseSignInStrategy } from "../../services/coinbase";
import { useTheme } from "../../providers/ThemeProvider";
import type { ColorPalette } from "../../utils/theme";
import { typography } from "../../utils/theme";

export const SignInScreen: React.FC = () => {
  const { connect, loading, error } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeStrategy, setActiveStrategy] = useState<CoinbaseSignInStrategy | null>(null);

  const handleConnect = async (strategy: CoinbaseSignInStrategy) => {
    setActiveStrategy(strategy);
    try {
      await connect(strategy);
    } finally {
      setActiveStrategy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MetaSend</Text>
      <Text style={styles.subtitle}>Send USDC to any email. Base network, gasless via Coinbase Paymaster.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>
        <Text style={styles.cardBody}>
          Sign in with your Coinbase Smart Wallet to create or resume your MetaSend account.
        </Text>
        <PrimaryButton
          title="Continue with Email"
          onPress={() => handleConnect("email")}
          loading={loading && activeStrategy === "email"}
          disabled={loading && activeStrategy === "social"}
        />
        <PrimaryButton
          title="Continue with Social"
          onPress={() => handleConnect("social")}
          loading={loading && activeStrategy === "social"}
          disabled={loading && activeStrategy === "email"}
          variant="accent"
        />
        {loading ? (
          <View style={styles.hintRow}>
            <ActivityIndicator color={colors.textSecondary} size="small" />
            <Text style={styles.hintText}>
              {activeStrategy === "social"
                ? "Opening Coinbase social sign-in..."
                : "Launching Coinbase email sign-in..."}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: colors.background,
      paddingVertical: 32,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 32,
      maxWidth: 320,
    },
    card: {
      width: "100%",
      backgroundColor: colors.cardBackground,
      padding: 24,
      borderRadius: 18,
      rowGap: 16,
    },
    cardTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    cardBody: {
      ...typography.body,
      color: colors.textSecondary,
    },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 8,
    },
    hintText: {
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
  });
