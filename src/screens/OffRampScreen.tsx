import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme } from "../providers/ThemeProvider";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

const providers = [
  {
    name: "Google Pay",
    description: "Instant off-ramp to fiat using Google Pay balance.",
    url: "https://pay.google.com/",
  },
  {
    name: "Apple Pay",
    description: "Cash out to Apple Cash or linked cards.",
    url: "https://www.apple.com/apple-pay/",
  },
  {
    name: "MoonPay",
    description: "On / off-ramp for fiat ↔︎ USDC with KYC.",
    url: "https://www.moonpay.com/buy/usdc",
  },
  {
    name: "Paybis",
    description: "Global ramp with cards and bank transfers.",
    url: "https://paybis.com/",
  },
];

export type OffRampScreenProps = NativeStackScreenProps<RootStackParamList, "OffRamp">;

export const OffRampScreen: React.FC<OffRampScreenProps> = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleOpen = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.warn("Cannot open provider url", url);
    }
  };

  return (
    <View style={styles.container}>
      {providers.map((provider) => (
        <View key={provider.url} style={styles.card}>
          <Text style={styles.title}>{provider.name}</Text>
          <Text style={styles.description}>{provider.description}</Text>
          <PrimaryButton title="Open" onPress={() => handleOpen(provider.url)} />
        </View>
      ))}
    </View>
  );
};
const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 18,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    description: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
