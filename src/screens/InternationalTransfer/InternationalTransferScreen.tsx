import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";

import { RootStackParamList } from "../../navigation/RootNavigator";
import { useTheme } from "../../providers/ThemeProvider";
import { spacing, typography } from "../../utils/theme";
import type { ColorPalette } from "../../utils/theme";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import { ToastModal } from "../../components/ToastModal";
import { useToast } from "../../utils/toast";
import {
  FundingMethod,
  PayoutMethod,
  PROVIDERS,
  SUPPORTED_COUNTRIES,
  ProviderConfig,
} from "../../constants/internationalProviders";
import {
  InternationalTransferDraft,
  InternationalTransferService,
  RecipientDetails,
} from "../../services/InternationalTransferService";

const STEP_TITLES = [
  "Destination",
  "Amount",
  "Provider",
  "Payment Method",
  "Recipient",
  "Review",
];

const payoutLabels: Record<PayoutMethod, string> = {
  bank_account: "Bank account",
  mobile_money: "Mobile money",
  cash_pickup: "Cash pickup",
  crypto_wallet: "Crypto wallet",
};

const fundingLabels: Record<FundingMethod, string> = {
  ach: "ACH bank",
  bank_transfer: "Bank transfer",
  debit_card: "Debit card",
  credit_card: "Credit card",
  crypto_wallet: "Crypto wallet",
};

type Props = NativeStackScreenProps<RootStackParamList, "InternationalTransfer">;

type RecipientField = {
  key: keyof RecipientDetails;
  label: string;
  placeholder?: string;
  required?: boolean;
};

const RECIPIENT_FIELDS: Record<PayoutMethod, RecipientField[]> = {
  bank_account: [
    { key: "fullName", label: "Recipient full name", placeholder: "Jane Doe", required: true },
    { key: "bankName", label: "Bank name", placeholder: "Zenith Bank", required: true },
    { key: "accountNumber", label: "Account number", placeholder: "0123456789", required: true },
    { key: "iban", label: "IBAN / Routing", placeholder: "Optional" },
    { key: "swift", label: "SWIFT / Sort code", placeholder: "Optional" },
    { key: "email", label: "Contact email", placeholder: "recipient@example.com" },
  ],
  mobile_money: [
    { key: "fullName", label: "Recipient full name", placeholder: "Ama Mensah", required: true },
    { key: "mobileWalletProvider", label: "Wallet provider", placeholder: "MTN Momo", required: true },
    { key: "mobileNumber", label: "Phone number", placeholder: "+233 55 000 0000", required: true },
    { key: "email", label: "Contact email", placeholder: "Optional" },
  ],
  cash_pickup: [
    { key: "fullName", label: "Recipient full name", required: true },
    { key: "email", label: "Email", placeholder: "Optional" },
  ],
  crypto_wallet: [
    { key: "fullName", label: "Recipient name (optional)" },
    { key: "accountNumber", label: "Wallet address", placeholder: "0x...", required: true },
  ],
};

export const InternationalTransferScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stepIndex, setStepIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [draft, setDraft] = useState<InternationalTransferDraft>({});
  const [recipientErrors, setRecipientErrors] = useState<Record<string, string>>({});
  const { toast, showToast, hideToast } = useToast();

  const recommendationFallback = useMemo(
    () =>
      InternationalTransferService.recommendProviders({
        countryCode: draft.destinationCountry?.code,
        amountUsd: draft.amountUsd,
        payoutMethod: draft.payoutMethod,
        fundingMethod: draft.fundingMethod,
      }),
    [draft.destinationCountry?.code, draft.amountUsd, draft.payoutMethod, draft.fundingMethod]
  );

  const quotesQuery = useQuery({
    queryKey: [
      "internationalQuotes",
      draft.destinationCountry?.code,
      draft.amountUsd,
      draft.payoutMethod,
      draft.fundingMethod,
    ],
    queryFn: () =>
      InternationalTransferService.getQuotes({
        countryCode: draft.destinationCountry?.code,
        amountUsd: draft.amountUsd,
        payoutMethod: draft.payoutMethod,
        fundingMethod: draft.fundingMethod,
      }),
    enabled: Boolean(draft.destinationCountry?.code && draft.amountUsd && draft.amountUsd > 0),
    staleTime: 60_000,
    retry: 1,
  });

  const providerQuotes = quotesQuery.data ?? recommendationFallback;
  const quotesLoading = quotesQuery.isFetching && Boolean(draft.destinationCountry?.code && draft.amountUsd);

  const selectedProvider = useMemo(() => {
    if (!draft.providerId) return undefined;
    return PROVIDERS.find((provider) => provider.id === draft.providerId);
  }, [draft.providerId]);

  const { fxRate, amountLocal } = useMemo(
    () => InternationalTransferService.calculateLocalAmount(draft.destinationCountry?.code, draft.amountUsd),
    [draft.destinationCountry?.code, draft.amountUsd]
  );

  const transferMutation = useMutation({
    mutationFn: InternationalTransferService.submitTransfer,
    onSuccess: (result) => {
      showToast(`Transfer submitted via ${result.providerId}. Reference ${result.referenceCode ?? "pending"}.`, "success");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "Transfer failed", "error");
    },
  });

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return SUPPORTED_COUNTRIES;
    return SUPPORTED_COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(search.trim().toLowerCase())
    );
  }, [search]);

  const handleSelectCountry = (code: string) => {
    const country = SUPPORTED_COUNTRIES.find((entry) => entry.code === code);
    if (!country) return;
    setDraft((prev) => ({ ...prev, destinationCountry: country, providerId: undefined }));
  };

  const handleSelectProvider = (provider: ProviderConfig) => {
    setDraft((prev) => ({ ...prev, providerId: provider.id }));
  };

  const handleSelectPayoutMethod = (method: PayoutMethod) => {
    setDraft((prev) => ({ ...prev, payoutMethod: method }));
  };

  const handleSelectFundingMethod = (method: FundingMethod) => {
    setDraft((prev) => ({ ...prev, fundingMethod: method }));
  };

  const updateRecipientField = (key: keyof RecipientDetails, value: string) => {
    setRecipientErrors((prev) => ({ ...prev, [key]: "" }));
    setDraft((prev) => ({
      ...prev,
      recipientDetails: {
        ...(prev.recipientDetails ?? {}),
        [key]: value,
      },
    }));
  };

  const validateRecipientDetails = () => {
    if (!draft.payoutMethod) return false;
    const fields = RECIPIENT_FIELDS[draft.payoutMethod];
    const details: RecipientDetails = draft.recipientDetails ?? {};
    const nextErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required && !details[field.key]) {
        nextErrors[field.key] = `${field.label} is required`;
      }
    });

    setRecipientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (stepIndex >= STEP_TITLES.length - 1) return;
    setStepIndex((prev) => prev + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setStepIndex((prev) => prev - 1);
  };

  const handleContinueFromStep = () => {
    switch (stepIndex) {
      case 0:
        if (!draft.destinationCountry) {
          showToast("Select a destination country", "error");
          return;
        }
        goNext();
        break;
      case 1:
        if (!draft.amountUsd || draft.amountUsd <= 0) {
          showToast("Enter a valid amount", "error");
          return;
        }
        goNext();
        break;
      case 2:
        if (!draft.providerId) {
          showToast("Choose a provider", "error");
          return;
        }
        goNext();
        break;
      case 3:
        if (!draft.payoutMethod || !draft.fundingMethod) {
          showToast("Select payout and payment methods", "error");
          return;
        }
        goNext();
        break;
      case 4:
        if (!validateRecipientDetails()) {
          showToast("Fill in recipient details", "error");
          return;
        }
        goNext();
        break;
      default:
        break;
    }
  };

  const handleSubmitTransfer = () => {
    if (!draft.destinationCountry || !draft.amountUsd || !draft.providerId || !draft.payoutMethod || !draft.fundingMethod) {
      showToast("Complete all steps before sending", "error");
      return;
    }

    transferMutation.mutate(draft);
  };

  const renderCountryStep = () => (
    <>
      <TextField
        label="Search destination"
        placeholder="Type a country name"
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView style={styles.listContainer}>
        {filteredCountries.map((country) => {
          const selected = draft.destinationCountry?.code === country.code;
          return (
            <TouchableOpacity
              key={country.code}
              style={[styles.countryRow, selected && styles.countryRowSelected]}
              onPress={() => handleSelectCountry(country.code)}
            >
              <View>
                <Text style={styles.countryName}>{country.name}</Text>
                <Text style={styles.countryMeta}>{country.currency} • {country.region}</Text>
              </View>
              {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  const renderAmountStep = () => (
    <>
      <TextField
        label="Amount in USD"
        keyboardType="decimal-pad"
        value={amountInput}
        onChangeText={(value) => {
          setAmountInput(value);
          const parsed = parseFloat(value);
          setDraft((prev) => ({
            ...prev,
            amountUsd: Number.isFinite(parsed) ? parsed : undefined,
          }));
        }}
      />
      {draft.destinationCountry && amountLocal && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Estimated payout</Text>
          <Text style={styles.infoValue}>
            {amountLocal.toFixed(2)} {draft.destinationCountry.currency}
          </Text>
          <Text style={styles.infoMeta}>FX ~ 1 USD = {fxRate.toFixed(2)} {draft.destinationCountry.currency}</Text>
        </View>
      )}
    </>
  );

  const renderProviderStep = () => (
    <ScrollView style={styles.listContainer}>
      {quotesLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyStateSubtitle, { marginTop: spacing.sm }]}>Fetching live quotes…</Text>
        </View>
      ) : providerQuotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No providers yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Pick a destination country to see available remittance providers.
          </Text>
        </View>
      ) : (
        providerQuotes.map((quote, index) => {
          const selected = draft.providerId === quote.provider.id;
          return (
            <TouchableOpacity
              key={quote.provider.id}
              style={[styles.providerCard, selected && styles.providerCardSelected]}
              onPress={() => handleSelectProvider(quote.provider)}
            >
              <View style={styles.providerHeader}>
                <Text style={styles.providerName}>{quote.provider.name}</Text>
                {index === 0 && <Text style={styles.recommendBadge}>Recommended</Text>}
              </View>
              <Text style={styles.providerDescription}>{quote.provider.description}</Text>
              <View style={styles.providerMetaRow}>
                <Text style={styles.providerMeta}>Fee ≈ ${quote.totalFeeUsd.toFixed(2)}</Text>
                <Text style={styles.providerMeta}>ETA {quote.deliveryEtaHours}h</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  const renderPaymentStep = () => (
    <View style={styles.methodContainer}>
      <Text style={styles.sectionTitle}>Payout method</Text>
      <View style={styles.chipGroup}>
        {(selectedProvider?.payoutMethods ?? []).map((method) => {
          const selected = draft.payoutMethod === method;
          return (
            <TouchableOpacity
              key={method}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleSelectPayoutMethod(method)}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {payoutLabels[method]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Payment method</Text>
      <View style={styles.chipGroup}>
        {(selectedProvider?.fundingMethods ?? []).map((method) => {
          const selected = draft.fundingMethod === method;
          return (
            <TouchableOpacity
              key={method}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleSelectFundingMethod(method)}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {fundingLabels[method]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderRecipientStep = () => {
    if (!draft.payoutMethod) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Select payout method first</Text>
          <Text style={styles.emptyStateSubtitle}>
            Choose how the recipient should receive funds before entering their details.
          </Text>
        </View>
      );
    }

    const fields = RECIPIENT_FIELDS[draft.payoutMethod];
    return (
      <View style={styles.recipientForm}>
        {fields.map((field) => (
          <View key={field.key}>
            <TextField
              label={field.label}
              value={draft.recipientDetails?.[field.key] ?? ""}
              placeholder={field.placeholder}
              onChangeText={(value) => updateRecipientField(field.key, value)}
            />
            {recipientErrors[field.key] ? (
              <Text style={styles.errorText}>{recipientErrors[field.key]}</Text>
            ) : null}
          </View>
        ))}
        <TextField
          label="Reference / note (optional)"
          value={draft.note ?? ""}
          onChangeText={(value) => setDraft((prev) => ({ ...prev, note: value }))}
          multiline
        />
      </View>
    );
  };

  const renderReviewStep = () => (
    <View style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>Review transfer</Text>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Destination</Text>
        <Text style={styles.reviewValue}>{draft.destinationCountry?.name}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Amount</Text>
        <Text style={styles.reviewValue}>{draft.amountUsd?.toFixed(2)} USD</Text>
      </View>
      {draft.destinationCountry && amountLocal && (
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Payout</Text>
          <Text style={styles.reviewValue}>
            {amountLocal.toFixed(2)} {draft.destinationCountry.currency}
          </Text>
        </View>
      )}
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Provider</Text>
        <Text style={styles.reviewValue}>{selectedProvider?.name}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Methods</Text>
        <Text style={styles.reviewValue}>
          {draft.payoutMethod ? payoutLabels[draft.payoutMethod] : ""} via {draft.fundingMethod ? fundingLabels[draft.fundingMethod] : ""}
        </Text>
      </View>
      <PrimaryButton
        title={transferMutation.isPending ? "Submitting..." : "Send transfer"}
        onPress={handleSubmitTransfer}
        loading={transferMutation.isPending}
      />
    </View>
  );

  const renderStepContent = () => {
    switch (stepIndex) {
      case 0:
        return renderCountryStep();
      case 1:
        return renderAmountStep();
      case 2:
        return renderProviderStep();
      case 3:
        return renderPaymentStep();
      case 4:
        return renderRecipientStep();
      case 5:
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack}>
            <Text style={styles.backAction}>{stepIndex === 0 ? "Cancel" : "Back"}</Text>
          </TouchableOpacity>
          <Text style={styles.stepTitle}>{STEP_TITLES[stepIndex]}</Text>
          <Text style={styles.stepCounter}>Step {stepIndex + 1} / {STEP_TITLES.length}</Text>
        </View>

        <View style={styles.content}>{renderStepContent()}</View>

        {stepIndex < STEP_TITLES.length - 1 && stepIndex !== 5 && (
          <View style={styles.footer}>
            <PrimaryButton title="Continue" onPress={handleContinueFromStep} />
          </View>
        )}
      </KeyboardAvoidingView>

      {transferMutation.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Connecting to provider…</Text>
        </View>
      )}

      <ToastModal visible={toast.visible} message={toast.message} type={toast.type} onDismiss={hideToast} />
    </View>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backAction: {
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    stepTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    stepCounter: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    listContainer: {
      flex: 1,
    },
    countryRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    countryRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.cardBackground,
    },
    countryName: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    countryMeta: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    selectedBadge: {
      color: colors.primary,
      fontWeight: "600",
    },
    infoCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    infoMeta: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    providerCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.cardBackground,
    },
    providerCardSelected: {
      borderColor: colors.primary,
      shadowColor: "rgba(0,0,0,0.1)",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    providerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    providerName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    recommendBadge: {
      color: colors.success,
      fontSize: 12,
      fontWeight: "600",
    },
    providerDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    providerMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    providerMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    emptyState: {
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    methodContainer: {
      gap: spacing.md,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    chipGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipLabel: {
      color: colors.textSecondary,
      fontWeight: "500",
    },
    chipLabelSelected: {
      color: "#fff",
    },
    recipientForm: {
      gap: spacing.md,
    },
    errorText: {
      color: colors.error,
      marginTop: spacing.xs,
      fontSize: 12,
    },
    reviewCard: {
      padding: spacing.lg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      gap: spacing.md,
    },
    reviewTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    reviewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    reviewLabel: {
      color: colors.textSecondary,
    },
    reviewValue: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    loadingText: {
      color: "#fff",
      fontWeight: "600",
    },
  });
