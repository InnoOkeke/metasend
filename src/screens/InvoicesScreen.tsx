import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { PrimaryButton } from "../components/PrimaryButton";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Invoices">;

export const InvoicesScreen: React.FC<Props> = () => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleCreateInvoice = () => {
    Alert.alert("Coming Soon", "Invoice creation is under development");
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in required</Text>
          <Text style={styles.subtitle}>Please sign in to manage invoices</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📄 Invoices</Text>
        <Text style={styles.headerSubtitle}>
          Create professional invoices and track payments
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>✨ Features</Text>
        <View style={styles.infoList}>
          <Text style={styles.infoItem}>• Add line items with quantities and prices</Text>
          <Text style={styles.infoItem}>• Automatic tax calculations</Text>
          <Text style={styles.infoItem}>• Set payment due dates</Text>
          <Text style={styles.infoItem}>• Track payment status</Text>
          <Text style={styles.infoItem}>• Send reminders for overdue invoices</Text>
          <Text style={styles.infoItem}>• Export to PDF</Text>
        </View>

        <PrimaryButton
          title="Create Invoice"
          onPress={handleCreateInvoice}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Your Invoices</Text>
        <Text style={styles.emptyText}>No invoices yet. Create your first one!</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    header: {
      marginBottom: spacing.lg,
    },
    headerTitle: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    headerSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 18,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    cardTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    infoList: {
      marginBottom: spacing.lg,
    },
    infoItem: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: spacing.xl,
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });
