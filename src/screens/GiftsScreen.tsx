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
import { cryptoGiftService, CreateGiftInput } from "../services/CryptoGiftService";
import { GiftTheme } from "../types/database";
import type { ColorPalette } from "../utils/theme";
import { spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Gifts">;

export const GiftsScreen: React.FC<Props> = () => {
  const { profile } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    recipientEmail: "",
    recipientName: "",
    amount: "",
    message: "",
    selectedTheme: "birthday" as GiftTheme,
  });

  const themes = cryptoGiftService.getAllThemes();

  const createGiftMutation = useMutation({
    mutationFn: async (input: CreateGiftInput) => {
      if (!profile) throw new Error("Not signed in");

      return await cryptoGiftService.createGift(
        profile.userId,
        profile.email,
        profile.displayName || undefined,
        input
      );
    },
    onSuccess: async (gift) => {
      const link = cryptoGiftService.generateGiftLink(gift.giftId);
      const themeConfig = cryptoGiftService.getGiftTheme(gift.theme);

      Alert.alert(
        `${themeConfig.emoji} Gift Sent!`,
        `Your ${gift.amount} USDC gift has been sent to ${gift.recipientEmail}!\n\nShare the link with them to claim it.`,
        [
          {
            text: "Copy Link",
            onPress: () => {
              Clipboard.setString(link);
              Alert.alert("✓ Copied!", "Gift link copied to clipboard");
            },
          },
          {
            text: "Share Link",
            onPress: () => {
              Share.share({
                message: `${themeConfig.emoji} ${themeConfig.description}\n\n${gift.message || "I sent you a crypto gift!"}\n\nClaim it here: ${link}`,
                title: `${themeConfig.name} Gift`,
              });
            },
          },
          {
            text: "Done",
            onPress: () => {
              setShowCreateModal(false);
              setForm({ recipientEmail: "", recipientName: "", amount: "", message: "", selectedTheme: "birthday" });
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to send gift");
    },
  });

  const handleSendGift = () => {
    if (!form.recipientEmail || !form.amount) {
      Alert.alert("Required Fields", "Please provide recipient email and amount");
      return;
    }

    createGiftMutation.mutate({
      recipientEmail: form.recipientEmail,
      recipientName: form.recipientName || undefined,
      amount: form.amount,
      token: "USDC",
      chain: "base",
      theme: form.selectedTheme,
      message: form.message || undefined,
      expiresInDays: 30,
    });
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in required</Text>
          <Text style={styles.subtitle}>Please sign in to send crypto gifts</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎁 Crypto Gifts</Text>
          <Text style={styles.headerSubtitle}>
            Send themed crypto gifts for special occasions
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎉 Occasions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeScroll}>
            {themes.map((theme) => (
              <View key={theme.theme} style={[styles.themeCard, { backgroundColor: theme.backgroundColor }]}>
                <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                <Text style={[styles.themeName, { color: theme.primaryColor }]}>{theme.name}</Text>
              </View>
            ))}
          </ScrollView>

          <PrimaryButton
            title="Send a Gift"
            onPress={() => setShowCreateModal(true)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 Your Gifts</Text>
          <Text style={styles.emptyText}>No gifts sent yet</Text>
        </View>
      </ScrollView>

      {/* Create Gift Modal */}
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
              <Text style={styles.modalTitle}>Send Crypto Gift</Text>
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
              <Text style={styles.sectionLabel}>Choose Theme</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeSelector}>
                {themes.map((theme) => (
                  <TouchableOpacity
                    key={theme.theme}
                    style={[
                      styles.themeSelectorCard,
                      { backgroundColor: theme.backgroundColor },
                      form.selectedTheme === theme.theme && styles.themeSelectorCardSelected,
                    ]}
                    onPress={() => setForm({ ...form, selectedTheme: theme.theme })}
                  >
                    <Text style={styles.themeSelectorEmoji}>{theme.emoji}</Text>
                    <Text style={[styles.themeSelectorName, { color: theme.primaryColor }]}>{theme.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextField
                label="Recipient Email *"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.recipientEmail}
                onChangeText={(value) => setForm({ ...form, recipientEmail: value })}
                placeholder="friend@example.com"
              />

              <TextField
                label="Recipient Name (Optional)"
                value={form.recipientName}
                onChangeText={(value) => setForm({ ...form, recipientName: value })}
                placeholder="John Doe"
              />

              <TextField
                label="Amount (USDC) *"
                keyboardType="numeric"
                value={form.amount}
                onChangeText={(value) => setForm({ ...form, amount: value })}
                placeholder="25.00"
              />

              <TextField
                label="Personal Message (Optional)"
                value={form.message}
                onChangeText={(value) => setForm({ ...form, message: value })}
                placeholder="Happy Birthday! 🎉"
                multiline
                numberOfLines={3}
              />

              <PrimaryButton
                title={createGiftMutation.isPending ? "Sending..." : "Send Gift"}
                onPress={handleSendGift}
                loading={createGiftMutation.isPending}
                disabled={createGiftMutation.isPending}
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
    themeScroll: {
      marginBottom: spacing.lg,
    },
    themeCard: {
      width: 100,
      height: 100,
      borderRadius: 16,
      padding: spacing.md,
      marginRight: spacing.sm,
      justifyContent: "center",
      alignItems: "center",
    },
    themeEmoji: {
      fontSize: 36,
      marginBottom: spacing.xs,
    },
    themeName: {
      ...typography.caption,
      fontWeight: "600",
      textAlign: "center",
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
    sectionLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: spacing.sm,
    },
    themeSelector: {
      marginBottom: spacing.lg,
    },
    themeSelectorCard: {
      width: 80,
      height: 80,
      borderRadius: 16,
      padding: spacing.sm,
      marginRight: spacing.sm,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    themeSelectorCardSelected: {
      borderColor: colors.primary,
    },
    themeSelectorEmoji: {
      fontSize: 28,
      marginBottom: spacing.xs,
    },
    themeSelectorName: {
      ...typography.caption,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
    },
  });
