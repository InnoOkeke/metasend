import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, Share, Clipboard, Platform } from "react-native";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { tippingService, CreateTipJarInput } from "../services/TippingService";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Tipping">;

const SUGGESTED_TIPS = [1, 5, 10, 25, 50, 100];

export const TippingScreen: React.FC<Props> = () => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const { data: tipJars, isLoading: isLoadingJars, refetch: refetchJars } = useQuery({
    queryKey: ["my-tip-jars", profile?.userId],
    queryFn: () => profile ? tippingService.getMyTipJars(profile.userId) : Promise.resolve([]),
    enabled: !!profile,
  });

  const toggleAmount = (amount: number) => {
    const selected = form.selectedAmounts;
    if (selected.includes(amount)) {
      setForm({ ...form, selectedAmounts: selected.filter(a => a !== amount) });
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
    onSuccess: async (jar) => {
      const link = tippingService.generateTipJarLink(jar.jarId);
      refetchJars();

      Alert.alert(
        "Tip Jar Created! 🎁",
        `Share your tip jar:\n${link}`,
        [
          {
            text: "Share Link",
            onPress: () => Share.share({ message: `Support me: ${link}` }),
          },
          {
            text: "Done",
            onPress: () => {
              setShowCreateModal(false);
              setForm({
                title: "",
                description: "",
                username: "",
                socialLinks: { twitter: "", farcaster: "", instagram: "", website: "" },
                selectedAmounts: [1, 5, 10, 25]
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
          <Text style={styles.headerSubtitle}>
            Receive tips from supporters with one-tap payments
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎁 Create Your Tip Jar</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Set custom tip amounts ($1-$100)</Text>
            <Text style={styles.infoItem}>• Share one link across all platforms</Text>
            <Text style={styles.infoItem}>• Instant notifications for each tip</Text>
            <Text style={styles.infoItem}>• No processing fees with Coinbase Paymaster</Text>
          </View>

          <PrimaryButton
            title="Create Tip Jar"
            onPress={() => setShowCreateModal(true)}
          />
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
                  <View style={[styles.statusBadge, jar.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, jar.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>{jar.status}</Text>
                  </View>
                </View>
                <Text style={styles.jarStats}>
                  {jar.tipCount} tips • ${jar.totalTipsReceived.toFixed(2)} received
                </Text>
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
              <Text style={styles.modalTitle}>Create Tip Jar</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              contentContainerStyle={[styles.modalBody, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
              enableAutomaticScroll
              enableOnAndroid
              extraScrollHeight={Platform.OS === 'ios' ? 40 : 120}
            >
              <TextField
                label="Title *"
                value={form.title}
                onChangeText={(value) => setForm({ ...form, title: value })}
                placeholder="Support My Content"
              />

              <TextField
                label="Description (Optional)"
                value={form.description}
                onChangeText={(value) => setForm({ ...form, description: value })}
                placeholder="Tips help me create more content!"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.sectionLabel}>Social Links (Optional)</Text>
              <TextField
                label="Twitter / X"
                value={form.socialLinks.twitter}
                onChangeText={(value) => setForm({ ...form, socialLinks: { ...form.socialLinks, twitter: value } })}
                placeholder="https://x.com/username"
                autoCapitalize="none"
              />
              <TextField
                label="Farcaster"
                value={form.socialLinks.farcaster}
                onChangeText={(value) => setForm({ ...form, socialLinks: { ...form.socialLinks, farcaster: value } })}
                placeholder="https://warpcast.com/username"
                autoCapitalize="none"
              />
              <TextField
                label="Instagram"
                value={form.socialLinks.instagram}
                onChangeText={(value) => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: value } })}
                placeholder="https://instagram.com/username"
                autoCapitalize="none"
              />
              <TextField
                label="Website"
                value={form.socialLinks.website}
                onChangeText={(value) => setForm({ ...form, socialLinks: { ...form.socialLinks, website: value } })}
                placeholder="https://mysite.com"
                autoCapitalize="none"
              />

              <Text style={styles.sectionLabel}>Suggested Tip Amounts (USDC)</Text>
              <Text style={styles.sectionHint}>Select 1-6 amounts</Text>

              <View style={styles.amountGrid}>
                {SUGGESTED_TIPS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.amountChip,
                      form.selectedAmounts.includes(amount) && styles.amountChipSelected,
                    ]}
                    onPress={() => toggleAmount(amount)}
                  >
                    <Text
                      style={[
                        styles.amountChipText,
                        form.selectedAmounts.includes(amount) && styles.amountChipTextSelected,
                      ]}
                    >
                      ${amount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PrimaryButton
                title={createJarMutation.isPending ? "Creating..." : "Create Tip Jar"}
                onPress={handleCreateJar}
                loading={createJarMutation.isPending}
                disabled={createJarMutation.isPending}
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

    // Jar Item Styles
    jarItem: {
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    jarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    jarTitle: {
      ...typography.subtitle,
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 12,
    },
    statusActive: {
      backgroundColor: colors.success + "20",
    },
    statusInactive: {
      backgroundColor: colors.textSecondary + "20",
    },
    statusText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statusTextActive: {
      color: colors.success,
    },
    statusTextInactive: {
      color: colors.textSecondary,
    },
    jarStats: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    jarActions: {
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
    sectionLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    sectionHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    amountGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    amountChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    amountChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "20",
    },
    amountChipText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    amountChipTextSelected: {
      color: colors.primary,
    },
  });
