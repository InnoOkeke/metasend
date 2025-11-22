import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Modal,
  Pressable,
  ScrollView,
  Animated,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme } from "../providers/ThemeProvider";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { spacing, typography } from "../utils/theme";
import { getUserLocation } from "../services/location";

type Props = NativeStackScreenProps<RootStackParamList, "Deposit">;

export const DepositScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { profile } = useCoinbase();
  const [activeMethod, setActiveMethod] = useState<"bank" | "card">("bank");
  const [amount, setAmount] = useState("");
  const [showMethodOptions, setShowMethodOptions] = useState(false);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const dropdownTranslateY = useRef(new Animated.Value(-50)).current;

  // Simple providers list (replace with real provider discovery)
  const regionProviders = [
    { name: "Coinbase", description: "Fast bank/card deposit", region: "US" },
    { name: "MoonPay", description: "Global card payments", region: "Global" },
    { name: "Transak", description: "Bank & card", region: "Global" },
  ];

  const getCurrencyFromCountryCode = (countryCode: string): { currency: string; symbol: string } => {
    const map: Record<string, { currency: string; symbol: string }> = {
      US: { currency: "USD", symbol: "$" },
      GB: { currency: "GBP", symbol: "£" },
      NG: { currency: "NGN", symbol: "₦" },
      KE: { currency: "KES", symbol: "KSh" },
      ZA: { currency: "ZAR", symbol: "R" },
      GH: { currency: "GHS", symbol: "GH₵" },
      JP: { currency: "JPY", symbol: "¥" },
      CN: { currency: "CNY", symbol: "¥" },
      IN: { currency: "INR", symbol: "₹" },
      BR: { currency: "BRL", symbol: "R$" },
      CA: { currency: "CAD", symbol: "CA$" },
      AU: { currency: "AUD", symbol: "A$" },
      NZ: { currency: "NZD", symbol: "NZ$" },
      MX: { currency: "MXN", symbol: "MX$" },
      AR: { currency: "ARS", symbol: "AR$" },
      DE: { currency: "EUR", symbol: "€" },
      FR: { currency: "EUR", symbol: "€" },
      IT: { currency: "EUR", symbol: "€" },
      ES: { currency: "EUR", symbol: "€" },
    };
    return map[countryCode] ?? { currency: "USD", symbol: "$" };
  };

  useEffect(() => {
    const detect = async () => {
      try {
        const loc = await getUserLocation();
        if (loc?.countryCode) {
          setCurrencySymbol(getCurrencyFromCountryCode(loc.countryCode).symbol);
          return;
        }
      } catch (e) {
        // ignore
      }
      // fallback to profile preference if provided
      if ((profile as any)?.currencySymbol) {
        setCurrencySymbol((profile as any).currencySymbol as string);
      }
    };
    detect();
  }, [profile]);

  const toggleDropdown = () => {
    if (showMethodOptions) {
      // closing
      Animated.parallel([
        Animated.timing(dropdownOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTranslateY, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowMethodOptions(false));
    } else {
      // opening
      setShowMethodOptions(true);
      dropdownOpacity.setValue(0);
      dropdownTranslateY.setValue(-50);
      Animated.parallel([
        Animated.timing(dropdownOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleContinue = () => {
    setShowProvidersModal(true);
  };

  const handleSeeAllProviders = () => {
    setShowProvidersModal(false);
    navigation.navigate("Providers", { amount, method: activeMethod });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.inner, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerText, { color: colors.textPrimary }]}>Select Payment Method</Text>
        {/* Single dropdown selector for payment method */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.methodDropdown, { borderColor: colors.border }]}
            activeOpacity={0.9}
            onPress={toggleDropdown}
          >
            <Text style={[styles.dropdownLabel, { color: colors.textPrimary }]}>{activeMethod === "bank" ? "Bank Transfer" : "Card"}</Text>
            <Text style={{ color: colors.textSecondary }}>{showMethodOptions ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {showMethodOptions && (
            <Animated.View style={[styles.dropdownOptions, { backgroundColor: colors.cardBackground, borderColor: colors.border, opacity: dropdownOpacity, transform: [{ translateY: dropdownTranslateY }] }]}>
              <TouchableOpacity style={styles.dropdownOption} onPress={() => { setActiveMethod("bank"); Animated.parallel([Animated.timing(dropdownOpacity, { toValue: 0, duration: 200, useNativeDriver: true }), Animated.timing(dropdownTranslateY, { toValue: -50, duration: 200, useNativeDriver: true })]).start(() => setShowMethodOptions(false)); }}>
                <Text style={{ color: colors.textPrimary }}>🏦 Bank Transfer</Text>
              </TouchableOpacity>
              <View style={styles.separator} />
              <TouchableOpacity style={styles.dropdownOption} onPress={() => { setActiveMethod("card"); Animated.parallel([Animated.timing(dropdownOpacity, { toValue: 0, duration: 200, useNativeDriver: true }), Animated.timing(dropdownTranslateY, { toValue: -50, duration: 200, useNativeDriver: true })]).start(() => setShowMethodOptions(false)); }}>
                <Text style={{ color: colors.textPrimary }}>💳 Card</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>{currencySymbol}</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.textPrimary }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            autoFocus
          />
        </View>

        <TouchableOpacity style={[styles.continueButton, { backgroundColor: colors.primary }]} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showProvidersModal} animationType="slide" transparent onRequestClose={() => setShowProvidersModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProvidersModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: (colors as any).cardBackground }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[typography.subtitle, { fontSize: 20, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: spacing.md }]}>Available Providers</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {regionProviders.map((provider, idx) => (
                <View key={provider.name + idx} style={[styles.providerRow, { backgroundColor: colors.background }]}>
                  <Text style={[styles.providerName, { color: colors.textPrimary }]}>{provider.name}</Text>
                  <Text style={[styles.providerDesc, { color: colors.textSecondary }]}>{provider.description}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.seeAll} onPress={handleSeeAllProviders}>
              <Text style={{ ...typography.subtitle, color: colors.primary, fontWeight: "700", fontSize: 16 }}>See all providers</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    padding: spacing.lg,
    flex: 1,
  },
  headerText: {
    ...typography.subtitle,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8 as any,
    marginBottom: spacing.lg,
    position: "relative",
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: 10,
  },
  tabText: {
    ...typography.body,
    fontWeight: "600",
  },
  amountContainer: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  currencySymbol: {
    ...typography.title,
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  amountInput: {
    ...typography.title,
    fontSize: 48,
    textAlign: "center",
    width: "100%",
  },
  methodDropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "transparent",
    minHeight: 50,
    width: "100%",
  },
  labelContainer: {
    flex: 1,
  },
  arrowContainer: {
    paddingLeft: spacing.sm,
  },
  dropdownLabel: {
    ...typography.body,
    fontWeight: "600",
  },
  dropdownOptions: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    paddingVertical: spacing.sm,
  },
  dropdownOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  separator: {
    height: 1,
    backgroundColor: "#E6E6E6",
    marginHorizontal: spacing.md,
  },
  continueButton: {
    paddingVertical: spacing.lg,
    borderRadius: 16,
    alignItems: "center",
    marginTop: "auto",
  },
  continueButtonText: {
    ...typography.subtitle,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
  },
  providerRow: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
  },
  providerName: {
    ...typography.subtitle,
    fontWeight: "600",
  },
  providerDesc: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  seeAll: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
});

