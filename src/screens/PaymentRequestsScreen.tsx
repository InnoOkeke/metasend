import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, Share, Clipboard, Platform } from "react-native";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation } from "@tanstack/react-query";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { paymentRequestService, CreatePaymentRequestInput } from "../services/PaymentRequestService";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentRequests">;

export const PaymentRequestsScreen: React.FC<Props> = () => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    payerEmail: "",
  });

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

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in required</Text>
          <Text style={styles.subtitle}>Please sign in to create payment requests</Text>
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
          <Text style={styles.cardTitle}>📋 Your Requests</Text>
          <Text style={styles.emptyText}>No payment requests yet</Text>
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
  });
