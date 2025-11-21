import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Share, Clipboard, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSendUserOperation } from "@coinbase/cdp-hooks";
import * as LocalAuthentication from "expo-local-authentication";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { tippingService, CreateTipJarInput } from "../services/TippingService";
import { sendUsdcWithPaymaster, TransferIntent } from "../services/transfers";
import { getUsdcBalance } from "../services/blockchain";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Tipping">;

const SUGGESTED_TIPS = [1, 5, 10, 25, 50, 100];

export const TippingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { sendUserOperation } = useSendUserOperation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipJarError, setTipJarError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    username: "",
    socialLinks: {
      twitter: "",
      farcaster: "",
      instagram: "",
      website: "",
    },
    selectedAmounts: [1, 5, 10, 25] as number[],
  });

  // Extract tipJarId from deep link params
  const { tipJarId } = route.params ?? {};

  // Fetch tip jar when deep link is present
  const {
    data: deepLinkJar,
    isLoading: isLoadingDeepLinkJar,
    error: deepLinkError,
  } = useQuery({
    queryKey: ["tipJar", tipJarId],
    queryFn: async () => {
      if (!tipJarId) return null;
      return await tippingService.getTipJar(tipJarId);
    },
    enabled: !!tipJarId,
    retry: false,
  });

  // Show tip modal when a jar is loaded via deep link
  useEffect(() => {
    if (deepLinkJar) {
      setShowTipModal(true);
    }
  }, [deepLinkJar]);

  // Handle errors for deep link fetching
  useEffect(() => {
    if (deepLinkError) {
      setTipJarError("Failed to load tip jar.");
    } else if (!isLoadingDeepLinkJar && tipJarId && !deepLinkJar) {
      setTipJarError("Tip jar not found for this ID.");
    } else {
      setTipJarError(null);
    }
  }, [deepLinkError, deepLinkJar, isLoadingDeepLinkJar, tipJarId]);

  // Load user's tip jars for the create list
  const { data: tipJars = [], isLoading: isLoadingJars, refetch: refetchJars } = useQuery({
    queryKey: ["my-tip-jars", profile?.userId],
    queryFn: () =>
      profile ? tippingService.getMyTipJars(profile.userId) : Promise.resolve([]),
    enabled: !!profile,
  });

  // Load USDC balance (optional)
  useQuery({
    queryKey: ["usdcBalance", profile?.walletAddress],
    queryFn: async () => {
      if (!profile?.walletAddress) return null;
      return await getUsdcBalance(profile.walletAddress as `0x${string}`);
    },
    enabled: !!profile?.walletAddress,
  });

  const toggleAmount = (amount: number) => {
    const selected = form.selectedAmounts;
    if (selected.includes(amount)) {
      setForm({ ...form, selectedAmounts: selected.filter((a) => a !== amount) });
    } else if (selected.length < 6) {
      setForm({ ...form, selectedAmounts: [...selected, amount].sort((a, b) => a - b) });
    }
  };

  const createJarMutation = useMutation({
    mutationFn: async (input: CreateTipJarInput) => {
      if (!profile) throw new Error("Not signed in");
      return await tippingService.createTipJar(
        profile.userId,
        profile.email,
        profile.displayName || undefined,
        profile.photoUrl || undefined,
        input
      );
    },
    onSuccess: (jar) => {
      const link = tippingService.generateTipJarLink(jar.jarId);
      // Refresh list
      refetchJars();
      Alert.alert(
        "Tip Jar Created! 🎁",
        `Share your tip jar:\n${link}`,
        [
          { text: "Share Link", onPress: () => Share.share({ message: `Support me: ${link}` }) },
          {
            text: "Done",
            onPress: () => {
              setShowCreateModal(false);
              setForm({
                title: "",
                description: "",
                username: "",
                socialLinks: { twitter: "", farcaster: "", instagram: "", website: "" },
                selectedAmounts: [1, 5, 10, 25],
              });
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create tip jar");
    },
  });

  const sendTipMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.walletAddress || !deepLinkJar) throw new Error("Not ready");
      const sendUserOpFn = async (calls: any[]) => {
        return await sendUserOperation({
          evmSmartAccount: profile.walletAddress as `0x${string}`,
          network: "base-sepolia",
          calls,
          useCdpPaymaster: true,
        });
      };

      const intent: TransferIntent = {
        recipientEmail: deepLinkJar.creatorEmail,
        amountUsdc: parseFloat(tipAmount),
        memo: tipMessage || `Tip for ${deepLinkJar.title}`,
        senderUserId: profile.userId,
        senderEmail: profile.email,
        senderName: profile.displayName,
      };

      const result = await sendUsdcWithPaymaster(
        profile.walletAddress as `0x${string}`,
        intent,
        sendUserOpFn
      );

      if (result.status !== "sent") {
        throw new Error("Tip transfer failed or queued");
      }

      await tippingService.sendTip(
        profile.userId,
        profile.email,
        profile.displayName || undefined,
        {
          jarId: deepLinkJar.jarId,
          amount: tipAmount,
          token: "USDC",
          chain: "base",
          message: tipMessage,
          isAnonymous: false,
        },
        result.txHash || "0x"
      );

      return result;
    },
    onSuccess: () => {
      setShowTipModal(false);
      Alert.alert("Success", "Tip sent successfully! 🚀");
      setTipAmount("");
      setTipMessage("");
      navigation.setParams({ tipJarId: undefined });
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to send tip");
    },
  });

  const handleSendTip = async () => {
    if (!tipAmount || isNaN(parseFloat(tipAmount))) {
      Alert.alert("Invalid Amount", "Please enter a valid tip amount");
      return;
    }
    setIsAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirm Tip" });
        if (!result.success) {
          setIsAuthenticating(false);
          return;
        }
      }
      sendTipMutation.mutate();
    } catch (e) {
      Alert.alert("Error", "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCreateJar = () => {
    if (!form.title || form.selectedAmounts.length === 0) {
      Alert.alert("Required Fields", "Please provide a title and select at least one tip amount");
      return;
    }
    createJarMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      username: form.username || undefined,
      socialLinks: {
        twitter: form.socialLinks.twitter || undefined,
        farcaster: form.socialLinks.farcaster || undefined,
        instagram: form.socialLinks.instagram || undefined,
        website: form.socialLinks.website || undefined,
      },
      suggestedAmounts: form.selectedAmounts,
      acceptedTokens: [{ token: "USDC", chain: "base" }],
    });
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in required</Text>
          <Text style={styles.subtitle}>Please sign in to create tip jars</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>💸 Micro-Tipping</Text>
          <Text style={styles.headerSubtitle}>Receive tips from supporters with one-tap payments</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎁 Create Your Tip Jar</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Set custom tip amounts ($1-$100)</Text>
            <Text style={styles.infoItem}>• Share one link across all platforms</Text>
            <Text style={styles.infoItem}>• Instant notifications for each tip</Text>
            <Text style={styles.infoItem}>• No processing fees with Coinbase Paymaster</Text>
          </View>
          <PrimaryButton title="Create Tip Jar" onPress={() => setShowCreateModal(true)} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Your Tip Jars</Text>
          {isLoadingJars ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : tipJars && tipJars.length > 0 ? (
            tipJars.map((jar) => (
              <View key={jar.jarId} style={styles.jarItem}>
                <View style={styles.jarHeader}>
                  <Text style={styles.jarTitle}>{jar.title}</Text>
                  <View style={[styles.statusBadge, jar.status === "active" ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, jar.status === "active" ? styles.statusTextActive : styles.statusTextInactive]}>{jar.status}</Text>
                  </View>
                </View>
                <Text style={styles.jarStats}>{jar.tipCount} tips • ${jar.totalTipsReceived.toFixed(2)} received</Text>
                <View style={styles.jarActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      const link = tippingService.generateTipJarLink(jar.jarId);
                      Share.share({ message: `Support me: ${link}` });
                    }}
                  >
                    <Text style={styles.actionButtonText}>Share Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      Clipboard.setString(tippingService.generateTipJarLink(jar.jarId));
                      Alert.alert("Copied", "Link copied to clipboard");
                    }}
                  >
                    <Text style={styles.actionButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No tip jars yet. Create one to get started!</Text>
          )}
        </View>
      </ScrollView>

      {/* Create Jar Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true} onRequestClose={() => setShowCreateModal(false)} statusBarTranslucent>
        <KeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Tip Jar</Text>
          <TextField label="Title" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} />
          <TextField label="Description" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} />
          <Text style={styles.sectionHeader}>Suggested Amounts</Text>
          <View style={styles.amountGrid}>
            {SUGGESTED_TIPS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[styles.amountChip, form.selectedAmounts.includes(amt) && styles.amountChipSelected]}
                onPress={() => toggleAmount(amt)}
              >
                <Text style={[styles.amountChipText, form.selectedAmounts.includes(amt) && styles.amountChipTextSelected]}>${amt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <PrimaryButton title="Create" onPress={handleCreateJar} />
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreateModal(false)}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </Modal>

      {/* Tip Modal */}
      <Modal visible={showTipModal} animationType="slide" transparent={true} onRequestClose={() => setShowTipModal(false)} statusBarTranslucent>
        <KeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
          {deepLinkJar && (
            <>
              <Text style={styles.modalTitle}>Tip {deepLinkJar.title}</Text>
              <Text style={styles.modalSubtitle}>Created by {deepLinkJar.creatorName}</Text>
              <TextField label="Amount (USDC)" value={tipAmount} onChangeText={setTipAmount} keyboardType="numeric" />
              <TextField label="Message (optional)" value={tipMessage} onChangeText={setTipMessage} />
              {isAuthenticating ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <PrimaryButton title="Send Tip" onPress={handleSendTip} />
              )}
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowTipModal(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
          {tipJarError && <Text style={styles.errorText}>{tipJarError}</Text>}
        </KeyboardAwareScrollView>
      </Modal>
    </>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    header: { marginBottom: spacing.lg },
    headerTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
    headerSubtitle: { ...typography.body, color: colors.textSecondary },
    card: { backgroundColor: colors.cardBackground, borderRadius: 18, padding: spacing.lg, marginBottom: spacing.md },
    cardTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm },
    infoList: { marginBottom: spacing.md },
    infoItem: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
    emptyText: { textAlign: "center", color: colors.textSecondary },
    jarItem: { marginBottom: spacing.md, backgroundColor: colors.background, padding: spacing.md, borderRadius: 12 },
    jarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
    jarTitle: { ...typography.subtitle, color: colors.textPrimary },
    statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: 8 },
    statusActive: { backgroundColor: colors.success },
    statusInactive: { backgroundColor: colors.error },
    statusText: { ...typography.caption, color: colors.background },
    statusTextActive: { color: colors.background },
    statusTextInactive: { color: colors.background },
    jarStats: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
    jarActions: { flexDirection: "row", justifyContent: "space-around" },
    actionButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      backgroundColor: colors.primary + "15",
      borderRadius: 12
    },
    actionButtonText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.primary,
      fontWeight: "600"
    },
    modalContent: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
    modalTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md, textAlign: "center" },
    modalSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md, textAlign: "center" },
    sectionHeader: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
    amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
    amountChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    amountChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    amountChipText: { ...typography.caption, color: colors.textPrimary },
    amountChipTextSelected: { color: colors.background, fontWeight: "600" },
    modalClose: { marginTop: spacing.md, alignItems: "center" },
    modalCloseText: { color: colors.accent, fontSize: 16 },
    errorText: { color: colors.error, textAlign: "center", marginTop: spacing.sm },
    title: { ...typography.title, color: colors.textPrimary },
    subtitle: { ...typography.body, color: colors.textSecondary },
  });
