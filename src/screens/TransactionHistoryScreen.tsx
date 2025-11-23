import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, typography } from "../utils/theme";
import { TransactionCard } from "../components/TransactionCard";
import { TransactionDetailsModal } from "../components/TransactionDetailsModal";
import { Linking } from "react-native";
import Constants from "expo-constants";
import type { ColorPalette } from "../utils/theme";
import { formatRelativeDate, formatShortAddress } from "../utils/format";
import { cancelPendingTransfer, getSentPendingTransfers, type PendingTransferSummary } from "../services/api";
import { useRecentActivity, ActivityItem } from "../hooks/useRecentActivity";
import { TransferRecord } from "../services/transfers";

type Props = NativeStackScreenProps<RootStackParamList, "TransactionHistory">;

type TabType = "all" | "sent" | "received" | "pending" | "expired";

const pendingStatusLabels: Record<PendingTransferSummary["status"], string> = {
  pending: "Pending",
  claimed: "Claimed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const TransactionHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [shouldPollPending, setShouldPollPending] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<ActivityItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const queryClient = useQueryClient();

  const { activities } = useRecentActivity();

  const { data: sentPendingTransfers } = useQuery({
    queryKey: ["sentPendingTransfers", profile?.userId],
    queryFn: () => {
      if (!profile?.userId) throw new Error("No user");
      return getSentPendingTransfers(profile.userId);
    },
    enabled: !!profile?.userId,
    refetchInterval: shouldPollPending ? 15000 : false,
  });

  useEffect(() => {
    if (!sentPendingTransfers) {
      setShouldPollPending(false);
      return;
    }
    setShouldPollPending(sentPendingTransfers.some(transfer => transfer.status === "pending"));
  }, [sentPendingTransfers]);

  const pendingTransferMap = useMemo(() => {
    const map = new Map<string, PendingTransferSummary>();
    sentPendingTransfers?.forEach(transfer => {
      map.set(transfer.transferId, transfer);
    });
    return map;
  }, [sentPendingTransfers]);

  type CancelTransferVariables = {
    transferId: string;
    placeholderId?: string;
  };

  const cancelTransferMutation = useMutation<string, Error, CancelTransferVariables>({
    mutationFn: async ({ transferId }: CancelTransferVariables) => {
      if (!profile?.userId) throw new Error("User not authenticated");
      return await cancelPendingTransfer(transferId, profile.userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["sentPendingTransfers"] });
      Alert.alert("Success", "Transfer cancelled and funds refunded");
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to cancel transfer");
    },
  });

  const getPendingSummaryForTransfer = useCallback(
    (transferId: string, recipientEmail?: string, amount?: number, createdAt?: number): PendingTransferSummary | undefined => {
      if (!sentPendingTransfers || sentPendingTransfers.length === 0) {
        return undefined;
      }

      // Try direct match first if we have a transfer ID (which might be the pendingTransferId)
      const directMatch = pendingTransferMap.get(transferId);
      if (directMatch) {
        return directMatch;
      }

      if (!recipientEmail || !amount || !createdAt) return undefined;

      const normalizedEmail = recipientEmail.toLowerCase();
      const targetAmount = amount;
      const transferTimestamp = createdAt;
      const MATCH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes tolerance

      return sentPendingTransfers.find(summary => {
        const summaryTimestamp = new Date(summary.createdAt).getTime();
        const sameEmail = summary.recipientEmail.toLowerCase() === normalizedEmail;
        const sameAmount = Number(summary.amount) === targetAmount;
        const withinWindow = Math.abs(summaryTimestamp - transferTimestamp) <= MATCH_WINDOW_MS;
        return sameEmail && sameAmount && withinWindow;
      });
    },
    [pendingTransferMap, sentPendingTransfers]
  );

  const handleCancelTransfer = (item: ActivityItem) => {
    // We need to reconstruct enough info to find the pending summary
    // For transfers, item.id is the transfer ID.
    // But for pending transfers, we might need the pendingTransferId which isn't directly in ActivityItem
    // However, useRecentActivity puts the transfer ID in item.id.

    // We can try to find the pending summary using metadata
    const pendingSummary = getPendingSummaryForTransfer(
      item.id,
      item.metadata?.to,
      Math.abs(item.amount),
      item.timestamp
    );

    const effectiveTransferId = pendingSummary?.transferId || item.id;

    if (!effectiveTransferId) {
      Alert.alert(
        "Transfer still syncing",
        "Please wait a few seconds while we register this pending transfer, then try again."
      );
      return;
    }

    Alert.alert(
      "Cancel Transfer?",
      "This will refund the USDC to your wallet. The recipient won't be able to claim it.",
      [
        { text: "Keep Transfer", style: "cancel" },
        {
          text: "Cancel Transfer",
          style: "destructive",
          onPress: () =>
            cancelTransferMutation.mutate({
              transferId: effectiveTransferId,
              placeholderId: item.id,
            })
        },
      ]
    );
  };

  const filteredActivities = useMemo(() => {
    if (activeTab === "all") return activities;

    return activities.filter(item => {
      if (activeTab === "sent") {
        return item.type.endsWith("-sent") ||
          item.type === "payment-request-received" || // I created request -> I sent request
          item.type === "payment-request-paid";     // I paid request -> I sent money
      }

      if (activeTab === "received") {
        return item.type.endsWith("-received") ||
          item.type === "invoice-received"; // I received invoice
      }

      if (activeTab === "pending") {
        return item.status === "pending";
      }

      if (activeTab === "expired") {
        return item.status === "expired";
      }

      return false;
    });
  }, [activities, activeTab]);

  const renderActivity = ({ item }: { item: ActivityItem }) => {
    const explorerUrl = Constants?.expoConfig?.extra?.BASE_EXPLORER_URL;

    // Check for pending transfer specific logic
    let subtitle = item.subtitle || "";
    let canCancel = false;
    let isCancelling = false;

    if (item.type === "transfer-sent" && item.status === "pending") {
      const pendingDetails = getPendingSummaryForTransfer(
        item.id,
        item.metadata?.to,
        Math.abs(item.amount),
        item.timestamp
      );

      if (pendingDetails) {
        subtitle = `${pendingStatusLabels[pendingDetails.status]} · ${formatRelativeDate(item.timestamp)}`;
        canCancel = pendingDetails.status === "pending";

        const effectiveTransferId = pendingDetails.transferId;
        isCancelling = Boolean(
          cancelTransferMutation.isPending &&
          effectiveTransferId &&
          cancelTransferMutation.variables &&
          (cancelTransferMutation.variables.transferId === effectiveTransferId ||
            cancelTransferMutation.variables.placeholderId === item.id)
        );
      } else {
        // Fallback if we can't find pending details but know it's pending
        subtitle = `Pending · ${formatRelativeDate(item.timestamp)}`;
        // Assume we can cancel if it's a pending transfer-sent
        canCancel = true;
      }
    } else {
      subtitle = `${item.status.charAt(0).toUpperCase() + item.status.slice(1)} · ${formatRelativeDate(item.timestamp)}`;
    }

    return (
      <TransactionCard
        title={item.title}
        subtitle={subtitle}
        amount={`${item.amount > 0 ? "+" : ""}${item.amount.toFixed(2)} ${item.currency}`}
        date={formatRelativeDate(item.timestamp)}
        transactionHash={item.txHash}
        explorerUrl={explorerUrl}
        onPress={() => {
          setSelectedTransaction(item);
          setModalVisible(true);
        }}
        onPressHash={item.txHash ? () => Linking.openURL(`${explorerUrl}/tx/${item.txHash}`) : undefined}
      >
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelTransfer(item)}
            disabled={cancelTransferMutation.isPending}
          >
            <Text style={styles.cancelButtonText}>
              {isCancelling ? "Cancelling..." : "Cancel Transfer"}
            </Text>
          </TouchableOpacity>
        )}
      </TransactionCard>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer} contentContainerStyle={styles.tabContentContainer}>
        {(["all", "sent", "received", "pending", "expired"] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />

      {selectedTransaction && (
        <TransactionDetailsModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          transaction={selectedTransaction}
        />
      )}
    </View>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonText: {
      fontSize: 24,
      color: colors.textPrimary,
    },
    headerTitle: {
      ...typography.title,
      fontSize: 18,
      color: colors.textPrimary,
    },
    placeholder: {
      width: 40,
    },
    tabContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxHeight: 60,
    },
    tabContentContainer: {
      paddingRight: spacing.md,
      alignItems: 'center',
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginRight: spacing.xs,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      minWidth: 70,
      alignItems: 'center',
      justifyContent: 'center',
      height: 32,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 13,
    },
    tabTextActive: {
      color: "#FFFFFF",
    },
    listContent: {
      padding: spacing.lg,
    },
    cancelButton: {
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.error + "20",
      borderRadius: 6,
      alignSelf: "flex-start",
    },
    cancelButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.error,
    },
    emptyContainer: {
      paddingVertical: spacing.xl * 2,
      alignItems: "center",
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
