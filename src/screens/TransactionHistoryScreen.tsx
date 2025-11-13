import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, typography } from "../utils/theme";
import type { ColorPalette } from "../utils/theme";
import { formatRelativeDate, formatShortAddress } from "../utils/format";
import { listTransfers, TransferRecord } from "../services/transfers";
import { getUsdcTransactions, type BlockchainTransaction } from "../services/blockchain";
import { getCryptoGifts, type CryptoGift } from "../services/gifts";
import { getPaymentRequests, type PaymentRequest } from "../services/paymentRequests";
import { getInvoices, type Invoice } from "../services/invoices";

type Props = NativeStackScreenProps<RootStackParamList, "TransactionHistory">;

type TabType = "all" | "sent" | "received" | "pending" | "expired";

type ActivityItem = {
  type: "transfer" | "blockchain" | "gift" | "payment-request" | "invoice";
  data: TransferRecord | BlockchainTransaction | CryptoGift | PaymentRequest | Invoice;
  timestamp: number;
};

export const TransactionHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const { data: transfers } = useQuery({
    queryKey: ["transfers", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return listTransfers(profile.walletAddress);
    },
    enabled: !!profile?.walletAddress,
  });

  const { data: blockchainTxs } = useQuery({
    queryKey: ["blockchainTransactions", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return getUsdcTransactions(profile.walletAddress as `0x${string}`);
    },
    enabled: !!profile?.walletAddress,
  });

  const { data: gifts } = useQuery({
    queryKey: ["gifts", profile?.email],
    queryFn: () => getCryptoGifts(profile?.email || profile?.walletAddress),
    enabled: !!profile,
  });

  const { data: paymentRequests } = useQuery({
    queryKey: ["paymentRequests", profile?.email],
    queryFn: () => getPaymentRequests(profile?.email),
    enabled: !!profile?.email,
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", profile?.email],
    queryFn: () => getInvoices(profile?.email),
    enabled: !!profile?.email,
  });

  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    transfers?.forEach(t => {
      items.push({
        type: "transfer",
        data: t,
        timestamp: new Date(t.createdAt).getTime(),
      });
    });

    blockchainTxs?.forEach(tx => {
      items.push({
        type: "blockchain",
        data: tx,
        timestamp: tx.timestamp,
      });
    });

    gifts?.forEach(g => {
      items.push({
        type: "gift",
        data: g,
        timestamp: new Date(g.createdAt).getTime(),
      });
    });

    paymentRequests?.forEach(pr => {
      items.push({
        type: "payment-request",
        data: pr,
        timestamp: new Date(pr.createdAt).getTime(),
      });
    });

    invoices?.forEach(inv => {
      items.push({
        type: "invoice",
        data: inv,
        timestamp: new Date(inv.createdAt).getTime(),
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [transfers, blockchainTxs, gifts, paymentRequests, invoices]);

  const filteredActivities = useMemo(() => {
    if (activeTab === "all") return activities;

    return activities.filter(item => {
      if (activeTab === "sent") {
        if (item.type === "transfer") return (item.data as TransferRecord).status === "sent";
        if (item.type === "blockchain") return (item.data as BlockchainTransaction).type === "sent";
        if (item.type === "gift") return (item.data as CryptoGift).fromEmail === profile?.email;
        if (item.type === "payment-request") return (item.data as PaymentRequest).fromEmail === profile?.email;
        if (item.type === "invoice") return (item.data as Invoice).fromEmail === profile?.email;
      }

      if (activeTab === "received") {
        if (item.type === "blockchain") return (item.data as BlockchainTransaction).type === "received";
        if (item.type === "gift") return (item.data as CryptoGift).toEmail === profile?.email;
        if (item.type === "payment-request") return (item.data as PaymentRequest).toEmail === profile?.email && (item.data as PaymentRequest).status === "paid";
        if (item.type === "invoice") return (item.data as Invoice).toEmail === profile?.email && (item.data as Invoice).status === "paid";
      }

      if (activeTab === "pending") {
        if (item.type === "transfer") return (item.data as TransferRecord).status === "pending_recipient_signup";
        if (item.type === "gift") return (item.data as CryptoGift).status === "pending";
        if (item.type === "payment-request") return (item.data as PaymentRequest).status === "pending";
        if (item.type === "invoice") return ["sent", "overdue"].includes((item.data as Invoice).status);
      }

      if (activeTab === "expired") {
        if (item.type === "gift") return (item.data as CryptoGift).status === "expired";
        if (item.type === "payment-request") return (item.data as PaymentRequest).status === "expired";
      }

      return false;
    });
  }, [activities, activeTab, profile]);

  const renderActivity = ({ item }: { item: ActivityItem }) => {
    if (item.type === "transfer") {
      const transfer = item.data as TransferRecord;
      return (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Text style={styles.activityEmoji}>📤</Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Transfer to {transfer.intent.recipientEmail}</Text>
            <Text style={styles.activitySubtitle}>
              {transfer.status === "sent" ? "Completed" : "Pending"} · {formatRelativeDate(transfer.createdAt)}
            </Text>
          </View>
          <Text style={styles.activityAmount}>{transfer.intent.amountUsdc.toFixed(2)} USDC</Text>
        </View>
      );
    }

    if (item.type === "blockchain") {
      const tx = item.data as BlockchainTransaction;
      return (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Text style={styles.activityEmoji}>{tx.type === "sent" ? "📤" : "📥"}</Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>
              {tx.type === "sent" ? "Sent to" : "Received from"} {formatShortAddress(tx.type === "sent" ? tx.to : tx.from)}
            </Text>
            <Text style={styles.activitySubtitle}>On-chain · {formatRelativeDate(tx.timestamp)}</Text>
          </View>
          <Text style={[styles.activityAmount, tx.type === "received" && styles.activityAmountPositive]}>
            {tx.type === "sent" ? "-" : "+"}{tx.value.toFixed(2)} USDC
          </Text>
        </View>
      );
    }

    if (item.type === "gift") {
      const gift = item.data as CryptoGift;
      const isSender = gift.fromEmail === profile?.email;
      return (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Text style={styles.activityEmoji}>🎁</Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>
              {isSender ? `Gift sent to ${gift.toEmail || "link"}` : `Gift received from ${gift.fromName}`}
            </Text>
            <Text style={styles.activitySubtitle}>
              {gift.status} · {formatRelativeDate(gift.createdAt)}
            </Text>
          </View>
          <Text style={[styles.activityAmount, !isSender && styles.activityAmountPositive]}>
            {isSender ? "-" : "+"}{gift.amount.toFixed(2)} {gift.currency}
          </Text>
        </View>
      );
    }

    if (item.type === "payment-request") {
      const request = item.data as PaymentRequest;
      const isRequester = request.fromEmail === profile?.email;
      return (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Text style={styles.activityEmoji}>💸</Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>
              {isRequester ? `Request to ${request.toEmail}` : `Request from ${request.fromEmail}`}
            </Text>
            <Text style={styles.activitySubtitle}>
              {request.status} · {formatRelativeDate(request.createdAt)}
            </Text>
          </View>
          <Text style={styles.activityAmount}>{request.amount.toFixed(2)} {request.currency}</Text>
        </View>
      );
    }

    if (item.type === "invoice") {
      const invoice = item.data as Invoice;
      const isSender = invoice.fromEmail === profile?.email;
      return (
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Text style={styles.activityEmoji}>📄</Text>
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>
              Invoice {invoice.invoiceNumber} {isSender ? `to ${invoice.toName}` : `from ${invoice.fromName}`}
            </Text>
            <Text style={styles.activitySubtitle}>
              {invoice.status} · {formatRelativeDate(invoice.createdAt)}
            </Text>
          </View>
          <Text style={styles.activityAmount}>{invoice.total.toFixed(2)} {invoice.currency}</Text>
        </View>
      );
    }

    return null;
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
        keyExtractor={(item, index) => `${item.type}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />
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
    },
    tabContentContainer: {
      justifyContent: 'space-around',
      flexGrow: 1,
      paddingRight: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginRight: spacing.xs,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      minWidth: 70,
      alignItems: 'center',
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
    activityCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    activityIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    activityEmoji: {
      fontSize: 20,
    },
    activityContent: {
      flex: 1,
    },
    activityTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: 4,
    },
    activitySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 12,
    },
    activityAmount: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    activityAmountPositive: {
      color: "#10B981",
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
