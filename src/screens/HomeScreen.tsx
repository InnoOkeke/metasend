import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, FlatList, ListRenderItemInfo, RefreshControl, Modal, Pressable, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { PrimaryButton } from "../components/PrimaryButton";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { listTransfers, TransferRecord } from "../services/transfers";
import { getUsdcBalance } from "../services/blockchain";
import { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, typography } from "../utils/theme";
import type { ColorPalette } from "../utils/theme";
import { formatRelativeDate, formatShortAddress } from "../utils/format";

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { profile, disconnect } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isExchangeModalVisible, setIsExchangeModalVisible] = useState(false);

  const hasBaseWallet = Boolean(profile?.walletAddress && profile.walletAddress.startsWith("0x"));

  // Query USDC balance
  const { data: usdcBalance, isLoading: loadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ["usdcBalance", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return getUsdcBalance(profile.walletAddress as `0x${string}`);
    },
    enabled: hasBaseWallet,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: transfers, refetch, isLoading, isRefetching } = useQuery({
    queryKey: ["transfers", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress || !profile.walletAddress.startsWith("0x")) {
        throw new Error("Wallet not available");
      }
      return listTransfers(profile.walletAddress);
    },
    enabled: hasBaseWallet,
  });

  useFocusEffect(
    useCallback(() => {
      if (hasBaseWallet) {
        refetch();
        refetchBalance();
      }
    }, [hasBaseWallet, refetch, refetchBalance])
  );

  const renderItem = ({ item }: ListRenderItemInfo<TransferRecord>) => (
    <View style={styles.transferRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.transferEmail}>{item.intent.recipientEmail}</Text>
        <Text style={styles.transferMeta}>
          {item.status === "sent" ? "Sent" : "Pending signup"} · {formatRelativeDate(item.createdAt)}
        </Text>
        {item.recipientWallet ? (
          <Text style={styles.transferMeta}>Wallet: {formatShortAddress(item.recipientWallet)}</Text>
        ) : null}
        {item.redemptionCode ? (
          <Text style={styles.transferMeta}>Redemption code: {item.redemptionCode}</Text>
        ) : null}
      </View>
      <Text style={styles.transferAmount}>{item.intent.amountUsdc.toFixed(2)} USDC</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.profileRow}>
          <View style={styles.profileDetails}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{profile?.displayName ?? profile?.email}</Text>
          </View>
        </View>
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            {loadingBalance ? "..." : usdcBalance !== undefined ? `$${usdcBalance.toFixed(2)}` : "$0.00"}
          </Text>
          <Text style={styles.balanceSubtext}>USDC on Base Sepolia</Text>
        </View>
        <View style={styles.walletPill}>
          <Text style={styles.walletLabel}>📍 Wallet</Text>
          <Text style={styles.walletAddress}>
            {profile && profile.walletAddress
              ? hasBaseWallet
                ? formatShortAddress(profile.walletAddress)
                : "Base wallet pending"
              : "-"}
          </Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("Send")}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>📤</Text>
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("OffRamp")}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>💳</Text>
          </View>
          <Text style={styles.actionLabel}>Add Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => {}/* Navigate to Activity */}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>📊</Text>
          </View>
          <Text style={styles.actionLabel}>Activity</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent transfers</Text>
        <Text style={styles.sectionSubtitle}>Pending recipients receive an email invite to claim funds.</Text>
      </View>

      <FlatList
  data={hasBaseWallet ? transfers ?? [] : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.emptyState}>
            {!hasBaseWallet
              ? "Connect a Base-compatible Coinbase Smart Wallet to view transfers."
              : isLoading
              ? "Loading transfers..."
              : "No transfers yet. Send your first USDC via email."}
          </Text>
        }
      />

      <Text style={styles.signOut} onPress={disconnect}>
        Sign out of Coinbase Wallet
      </Text>

      {/* Exchange Modal */}
      <Modal
        visible={isExchangeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsExchangeModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsExchangeModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Exchange</Text>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsExchangeModalVisible(false);
                navigation.navigate("OffRamp");
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>💰</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Buy Crypto</Text>
                <Text style={styles.modalOptionSubtitle}>Add funds to your wallet</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsExchangeModalVisible(false);
                // TODO: Navigate to withdraw screen
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>🏦</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Withdraw</Text>
                <Text style={styles.modalOptionSubtitle}>Cash out to your bank</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setIsExchangeModalVisible(false)}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>✖️</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Footer with Exchange Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.exchangeButton}
          onPress={() => setIsExchangeModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.exchangeIconWrapper}>
            <Text style={styles.exchangeIconText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    heroCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      padding: spacing.xl,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    profileDetails: {
      flex: 1,
      marginLeft: spacing.md,
    },
    greeting: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 14,
    },
    username: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
    },
    balanceSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    balanceLabel: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: spacing.xs,
    },
    balanceAmount: {
      fontSize: 42,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    balanceSubtext: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
    },
    walletLabel: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
    },
    walletAddress: {
      ...typography.body,
      color: colors.textPrimary,
      fontFamily: "monospace",
      fontSize: 13,
    },
    walletPill: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: `${colors.primary}08`,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 12,
    },
    quickActions: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    actionCard: {
      alignItems: "center",
      justifyContent: "center",
    },
    actionIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    actionIcon: {
      fontSize: 28,
    },
    actionLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "500",
    },
    sectionHeader: {
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
    },
    list: {
      flex: 1,
    },
    listContent: {
      rowGap: spacing.md,
      paddingBottom: 100,
      paddingHorizontal: spacing.lg,
    },
    transferRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      padding: spacing.md,
      borderRadius: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    transferEmail: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "500",
    },
    transferMeta: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    transferAmount: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    emptyState: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xl,
      fontSize: 14,
    },
    signOut: {
      color: colors.textSecondary,
      textAlign: "center",
      marginVertical: spacing.lg,
      fontSize: 14,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 84,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: `${colors.border}40`,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: spacing.sm,
    },
    exchangeButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    exchangeIconWrapper: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    exchangeIconText: {
      fontSize: 28,
      fontWeight: "300",
      color: "#FFFFFF",
      lineHeight: 28,
    },
    exchangeIcon: {
      fontSize: 32,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.textSecondary,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: spacing.lg,
      opacity: 0.3,
    },
    modalTitle: {
      ...typography.subtitle,
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    modalOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalOptionIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${colors.primary}14`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    modalOptionEmoji: {
      fontSize: 24,
    },
    modalOptionText: {
      flex: 1,
    },
    modalOptionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "600",
    },
    modalOptionSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
  });
