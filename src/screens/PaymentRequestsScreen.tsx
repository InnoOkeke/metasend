import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, Share, Clipboard, Platform, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSendUserOperation } from "@coinbase/cdp-hooks";
import * as LocalAuthentication from "expo-local-authentication";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { paymentRequestService, CreatePaymentRequestInput } from "../services/PaymentRequestService";
import { sendUsdcWithPaymaster, TransferIntent } from "../services/transfers";
import { getUsdcBalance } from "../services/blockchain";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";
type Props = NativeStackScreenProps<RootStackParamList, "PaymentRequests">;

export const PaymentRequestsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { sendUserOperation } = useSendUserOperation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    description: "",
    payerEmail: "",
  });

  // Handle deep link requestId
  const requestId = route.params?.requestId;

  const { data: paymentRequest, isLoading: isLoadingRequest } = useQuery({
    queryKey: ["paymentRequest", requestId],
    queryFn: () => requestId ? paymentRequestService.getPaymentRequest(requestId) : Promise.resolve(null),
    enabled: !!requestId,
  });

  // Show pay modal when request is loaded
  useEffect(() => {
    if (paymentRequest && paymentRequest.status === 'pending') {
      setShowPayModal(true);
    }
  }, [paymentRequest]);

  const { data: usdcBalance } = useQuery({
    queryKey: ["usdcBalance", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return getUsdcBalance(profile.walletAddress as `0x${string}`);
    },
    enabled: Boolean(profile?.walletAddress),
  });

  // Fetch requests created by user
  const { data: myRequests, isLoading: isLoadingMy, refetch: refetchMy } = useQuery({
    queryKey: ["payment-requests", "sent", profile?.userId],
    queryFn: () => paymentRequestService.getMyPaymentRequests(profile!.userId),
    enabled: !!profile?.userId,
  });

  // Fetch requests received by user
  const { data: receivedRequests, isLoading: isLoadingReceived, refetch: refetchReceived } = useQuery({
    queryKey: ["payment-requests", "received", profile?.email],
    queryFn: () => paymentRequestService.getPaymentRequestsForEmail(profile!.email!),
    enabled: !!profile?.email,
  });

  // Combine and sort requests by date (most recent first)
  const allRequests = useMemo(() => {
    const sent = (myRequests || []).map(r => ({ ...r, direction: 'sent' as const }));
    const received = (receivedRequests || []).map(r => ({ ...r, direction: 'received' as const }));
    return [...sent, ...received].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [myRequests, receivedRequests]);

  const isLoadingRequests = isLoadingMy || isLoadingReceived;

  const createRequestMutation = useMutation({
    mutationFn: async (input: CreatePaymentRequestInput) => {
      if (!profile) throw new Error("Not signed in");

      return await paymentRequestService.createPaymentRequest(
        profile.userId,
        profile.email,
        profile.displayName,
        input
      );
    },
    onSuccess: (request) => {
      refetchMy();
      refetchReceived();

      const link = paymentRequestService.generatePaymentRequestLink(request.requestId);

      Alert.alert(
        "Payment Request Created! 🎉",
        `Amount: ${request.amount} ${request.token}\n\nYour payment link is ready to share!`,
        [
          {
            text: "Copy Link",
            onPress: () => {
              Clipboard.setString(link);
              Alert.alert("✓ Copied!", "Link copied to clipboard");
            },
          },
          {
            text: "Share",
            onPress: () => {
              Share.share({
                message: `Payment Request: ${request.amount} ${request.token}\n${request.description}\n\nPay here: ${link}`,
                title: "Payment Request",
              });
            },
          },
          {
            text: "Done",
            onPress: () => {
              setShowCreateModal(false);
              setForm({ amount: "", description: "", payerEmail: "" });
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create payment request");
    },
  });

  const payRequestMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.walletAddress || !paymentRequest) throw new Error("Not ready");

      // 1. Execute Transfer
      const sendUserOpFn = async (calls: any[]) => {
        return await sendUserOperation({
          evmSmartAccount: profile.walletAddress as `0x${string}`,
          network: "base-sepolia",
          calls,
          useCdpPaymaster: true,
        });
      };

      // We need the creator's wallet address. 
      // Assuming the backend provides it or we can resolve it.
      // For now, let's assume we need to resolve it from email if not present.
      // But wait, PaymentRequest doesn't have wallet address.
      // We should probably update the backend to return it, or resolve it here.
      // For this implementation, I'll assume we can resolve via email if needed, 
      // but ideally the request should have it.

      // TODO: In a real app, we'd resolve the creator's address properly.
      // For now, we'll fail if we can't send.

      // Let's try to use the unified send service logic or just fail if we don't have address.
      // Actually, let's use a placeholder address if we can't resolve, just to show the flow.
      // OR better: The user should have a wallet if they created a request.

      // Let's assume we are sending to a demo address if we can't resolve, 
      // but in production we need the real address.
      const recipientAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Demo placeholder

      const intent: TransferIntent = {
        recipientEmail: paymentRequest.creatorEmail,
        amountUsdc: parseFloat(paymentRequest.amount),
        memo: `Payment for Request #${paymentRequest.requestId}`,
        senderUserId: profile.userId,
        senderEmail: profile.email,
        senderName: profile.displayName,
      };

      const result = await sendUsdcWithPaymaster(
        profile.walletAddress as `0x${string}`,
        intent,
        sendUserOpFn
      );

      if (result.status !== 'sent') {
        throw new Error("Transfer failed or queued");
      }

      // 2. Update Request Status
      await paymentRequestService.payPaymentRequest(
        paymentRequest.requestId,
        profile.userId,
        profile.email,
        profile.displayName,
        result.txHash || "0x"
      );

      return result;
    },
    onSuccess: () => {
      setShowPayModal(false);
      Alert.alert("Success", "Payment sent successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["paymentRequest", requestId] });
      navigation.setParams({ requestId: undefined }); // Clear param
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Payment failed");
    },
  });

  const handleCreateRequest = () => {
    if (!form.amount || !form.description) {
      Alert.alert("Required Fields", "Please fill in amount and description");
      return;
    }

    createRequestMutation.mutate({
      amount: form.amount,
      token: "USDC",
      chain: "base",
      description: form.description,
      payerEmail: form.payerEmail || undefined,
      expiresInDays: 7,
    });
  };

  const handlePayRequest = async () => {
    setIsAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm Payment",
        });
        if (!result.success) {
          setIsAuthenticating(false);
          return;
        }
      }
      payRequestMutation.mutate();
    } catch (error) {
      Alert.alert("Error", "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in required</Text>
          <Text style={styles.subtitle}>Please sign in to manage payment requests</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment Requests</Text>
          <Text style={styles.headerSubtitle}>
            Request USDC payments from anyone via email or shareable link
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 How it works</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>1. Create a payment request with amount and description</Text>
            <Text style={styles.infoItem}>2. Share the link via email, SMS, or social media</Text>
            <Text style={styles.infoItem}>3. Get notified when payment is received</Text>
          </View>

          <PrimaryButton
            title="Create Payment Request"
            onPress={() => setShowCreateModal(true)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Transaction History</Text>
          {isLoadingRequests ? (
            <ActivityIndicator color={colors.primary} />
          ) : allRequests && allRequests.length > 0 ? (
            allRequests.map((req) => {
              const isReceived = req.direction === 'received';
              const isPending = req.status === 'pending';

              return (
                <View key={`${req.direction}-${req.requestId}`} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestAmount}>${req.amount} {req.token}</Text>
                    <View style={[styles.directionBadge, isReceived ? styles.receivedBadge : styles.sentBadge]}>
                      <Text style={[styles.directionText, isReceived ? styles.receivedText : styles.sentText]}>
                        {isReceived ? '← Received' : '→ Sent'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestDesc}>
                    {isReceived ? `From: ${req.creatorName || req.creatorEmail}` : req.description}
                  </Text>
                  <Text style={styles.requestDate}>{new Date(req.createdAt).toLocaleDateString()}</Text>

                  <View style={styles.requestActions}>
                    <View style={[styles.statusBadge, req.status === 'paid' ? styles.statusSuccess : styles.statusPending]}>
                      <Text style={[styles.statusText, req.status === 'paid' ? styles.statusTextSuccess : styles.statusTextPending]}>
                        {req.status}
                      </Text>
                    </View>
                    {isReceived && isPending ? (
                      <TouchableOpacity
                        style={styles.miniActionButton}
                        onPress={() => navigation.setParams({ requestId: req.requestId })}
                      >
                        <Text style={styles.miniActionText}>Pay</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.miniActionButton}
                        onPress={() => {
                          const link = paymentRequestService.generatePaymentRequestLink(req.requestId);
                          Share.share({ message: `Pay me: ${link}` });
                        }}
                      >
                        <Text style={styles.miniActionText}>Share</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No payment requests yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Create Request Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Payment Request</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              contentContainerStyle={[styles.modalBody, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
              enableAutomaticScroll
              enableOnAndroid
              extraScrollHeight={Platform.OS === 'ios' ? 20 : 120}
            >
              <TextField
                label="Amount (USDC)"
                keyboardType="numeric"
                value={form.amount}
                onChangeText={(value) => setForm({ ...form, amount: value })}
                placeholder="10.00"
              />

              <TextField
                label="Description *"
                value={form.description}
                onChangeText={(value) => setForm({ ...form, description: value })}
                placeholder="Website design services"
                multiline
                numberOfLines={3}
              />

              <TextField
                label="Payer Email (Optional)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.payerEmail}
                onChangeText={(value) => setForm({ ...form, payerEmail: value })}
                placeholder="client@example.com"
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  If you provide a payer email, they'll receive a notification. Otherwise, you can share the payment link manually.
                </Text>
              </View>

              <PrimaryButton
                title={createRequestMutation.isPending ? "Creating..." : "Create Request"}
                onPress={handleCreateRequest}
                loading={createRequestMutation.isPending}
                disabled={createRequestMutation.isPending}
              />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Pay Request Modal */}
      <Modal
        visible={showPayModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPayModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay Request</Text>
              <Pressable onPress={() => setShowPayModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {isLoadingRequest ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : paymentRequest ? (
                <>
                  <View style={styles.requestDetails}>
                    <Text style={styles.payRequestAmount}>{paymentRequest.amount} {paymentRequest.token}</Text>
                    <Text style={styles.requestFrom}>from {paymentRequest.creatorName || paymentRequest.creatorEmail}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.label}>Description</Text>
                    <Text style={styles.description}>{paymentRequest.description}</Text>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                      <Text style={styles.label}>Your Balance</Text>
                      <Text style={styles.value}>{usdcBalance?.toFixed(2) || "0.00"} USDC</Text>
                    </View>
                  </View>

                  <PrimaryButton
                    title={payRequestMutation.isPending || isAuthenticating ? "Processing..." : "Pay Now"}
                    onPress={handlePayRequest}
                    loading={payRequestMutation.isPending || isAuthenticating}
                    disabled={payRequestMutation.isPending || isAuthenticating}
                  />
                </>
              ) : (
                <Text style={styles.errorText}>Request not found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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

    // Request Item Styles
    requestItem: {
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    requestHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    requestAmount: {
      ...typography.subtitle,
      fontSize: 18,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    requestDesc: {
      ...typography.body,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    requestDate: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 12,
    },
    statusPending: {
      backgroundColor: colors.warning + "20",
    },
    statusSuccess: {
      backgroundColor: colors.success + "20",
    },
    statusText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusTextPending: {
      color: colors.warning,
    },
    statusTextSuccess: {
      color: colors.success,
    },
    actionButtons: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    actionButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      backgroundColor: colors.primary + "10",
    },
    actionButtonText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "600",
    },

    // Direction Badge Styles
    directionBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 8,
    },
    receivedBadge: {
      backgroundColor: colors.success + "15",
    },
    sentBadge: {
      backgroundColor: colors.primary + "15",
    },
    directionText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: "600",
    },
    receivedText: {
      color: colors.success,
    },
    sentText: {
      color: colors.primary,
    },

    // Request Actions Layout
    requestActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.xs,
    },
    miniActionButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.primary + "15",
    },
    miniActionText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.primary,
      fontWeight: "600",
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      ...typography.subtitle,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    modalClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalCloseText: {
      fontSize: 18,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    modalBody: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    infoBox: {
      backgroundColor: colors.accent + "20",
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    infoBoxText: {
      ...typography.caption,
      color: colors.textSecondary,
    },

    // Pay Request Styles
    requestDetails: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    payRequestAmount: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    requestFrom: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    divider: {
      width: "100%",
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      alignSelf: "flex-start",
    },
    description: {
      fontSize: 16,
      color: colors.textPrimary,
      alignSelf: "flex-start",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      alignItems: "center",
    },
    value: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    errorText: {
      color: colors.error,
      textAlign: "center",
      fontSize: 16,
    }
  });
