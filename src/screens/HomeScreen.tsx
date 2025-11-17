import React, { useCallback, useMemo, useState, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View, FlatList, ListRenderItemInfo, RefreshControl, Modal, Pressable, TouchableOpacity, ScrollView, Clipboard, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WebView } from "react-native-webview";

import { PrimaryButton } from "../components/PrimaryButton";
import { ToastModal } from "../components/ToastModal";
import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { listTransfers, TransferRecord } from "../services/transfers";
import { getUsdcBalance, getUsdcTransactions, type BlockchainTransaction } from "../services/blockchain";
import { pendingTransferService, type PendingTransferSummary } from "../services/PendingTransferService";
import { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, typography } from "../utils/theme";
import type { ColorPalette } from "../utils/theme";
import { formatRelativeDate, formatShortAddress } from "../utils/format";
import { useToast } from "../utils/toast";
import {
  buildRampUrl,
  getAvailableProviders,
  getCoinbasePaymentMethods,
  fetchCoinbasePaymentMethods,
  getPaymentMethodName,
  getPaymentMethodDescription,
  getProviderInfo,
  type PaymentMethod,
  type RampProvider,
  type RampType,
} from "../services/ramp";
import {
  checkLocationPermission,
  requestLocationPermission,
  getUserLocation,
  type LocationPermissionStatus,
} from "../services/location";

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { profile, disconnect } = useCoinbase();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isExchangeModalVisible, setIsExchangeModalVisible] = useState(false);
  const [isMoreFeaturesModalVisible, setIsMoreFeaturesModalVisible] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [isCurrencySelectorVisible, setIsCurrencySelectorVisible] = useState(false);
  const [selectedRampType, setSelectedRampType] = useState<RampType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<RampProvider | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "settings">("home");
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<RampProvider[]>([]);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>('undetermined');
  const [userCountry, setUserCountry] = useState<string>('');
  const [userCountryCode, setUserCountryCode] = useState<string>('');
  const [userCurrency, setUserCurrency] = useState<string>('USD');
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [fxRate, setFxRate] = useState<number>(1);
  const { scheme, setScheme } = useTheme();
  const { toast, showToast, hideToast } = useToast();

  // Helper function to get currency from country code
  const fetchFxRate = async (currency: string) => {
    if (currency === 'USD') {
      setFxRate(1);
      return;
    }
    
    try {
      // Using a free FX API (exchangerate-api.com)
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
      const data = await response.json();
      
      if (data.rates && data.rates[currency]) {
        setFxRate(data.rates[currency]);
      } else {
        setFxRate(1);
      }
    } catch (error) {
      console.error('Error fetching FX rate:', error);
      setFxRate(1);
    }
  };

  const getCurrencyFromCountryCode = (countryCode: string): { currency: string; symbol: string } => {
    const currencyByCountry: Record<string, { currency: string; symbol: string }> = {
      'US': { currency: 'USD', symbol: '$' },
      'GB': { currency: 'GBP', symbol: '£' },
      'NG': { currency: 'NGN', symbol: '₦' },
      'KE': { currency: 'KES', symbol: 'KSh' },
      'ZA': { currency: 'ZAR', symbol: 'R' },
      'GH': { currency: 'GHS', symbol: 'GH₵' },
      'JP': { currency: 'JPY', symbol: '¥' },
      'CN': { currency: 'CNY', symbol: '¥' },
      'IN': { currency: 'INR', symbol: '₹' },
      'BR': { currency: 'BRL', symbol: 'R$' },
      'CA': { currency: 'CAD', symbol: 'CA$' },
      'AU': { currency: 'AUD', symbol: 'A$' },
      'NZ': { currency: 'NZD', symbol: 'NZ$' },
      'MX': { currency: 'MXN', symbol: 'MX$' },
      'AR': { currency: 'ARS', symbol: 'AR$' },
      'DE': { currency: 'EUR', symbol: '€' },
      'FR': { currency: 'EUR', symbol: '€' },
      'IT': { currency: 'EUR', symbol: '€' },
      'ES': { currency: 'EUR', symbol: '€' },
      'NL': { currency: 'EUR', symbol: '€' },
      'BE': { currency: 'EUR', symbol: '€' },
      'AT': { currency: 'EUR', symbol: '€' },
      'PT': { currency: 'EUR', symbol: '€' },
      'IE': { currency: 'EUR', symbol: '€' },
      'FI': { currency: 'EUR', symbol: '€' },
      'GR': { currency: 'EUR', symbol: '€' },
    };
    return currencyByCountry[countryCode] ?? { currency: 'USD', symbol: '$' };
  };

  // Popular currencies for manual selection
  const popularCurrencies = [
    { currency: 'USD', symbol: '$', name: 'US Dollar' },
    { currency: 'EUR', symbol: '€', name: 'Euro' },
    { currency: 'GBP', symbol: '£', name: 'British Pound' },
    { currency: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { currency: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    { currency: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { currency: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
    { currency: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { currency: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { currency: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { currency: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { currency: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
    { currency: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { currency: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    { currency: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    { currency: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  ];

  const handleCurrencySelect = (selectedCurrency: { currency: string; symbol: string; name: string }) => {
    setUserCurrency(selectedCurrency.currency);
    setCurrencySymbol(selectedCurrency.symbol);
    setIsCurrencySelectorVisible(false);
  };

  // Check location permission on mount
  React.useEffect(() => {
    checkLocationPermission().then(status => {
      setLocationPermission(status);
      if (status === 'granted') {
        getUserLocation().then(loc => {
          if (loc) {
            setUserCountry(`${loc.country} (${loc.countryCode})`);
            const currencyData = getCurrencyFromCountryCode(loc.countryCode);
            setUserCurrency(currencyData.currency);
            setCurrencySymbol(currencyData.symbol);
          }
        });
      } else {
        // Fallback to device locale
        const locale = Intl.NumberFormat().resolvedOptions().locale;
        const region = locale.split('-')[1]?.toUpperCase();
        if (region) {
          const currencyData = getCurrencyFromCountryCode(region);
          setUserCurrency(currencyData.currency);
          setCurrencySymbol(currencyData.symbol);
        }
      }
    });
  }, []);

  // Fetch available providers when ramp type changes
  React.useEffect(() => {
    if (selectedRampType) {
      getAvailableProviders(selectedRampType).then(providers => {
        setAvailableProviders(providers);
      });
    } else {
      setAvailableProviders([]);
    }
  }, [selectedRampType]);

  // Fetch payment methods when provider and type are selected
  React.useEffect(() => {
    if (selectedProvider === "coinbase" && selectedRampType && profile?.walletAddress) {
      setLoadingPaymentMethods(true);
      fetchCoinbasePaymentMethods(selectedRampType, profile.walletAddress)
        .then(methods => {
          setAvailablePaymentMethods(methods);
        })
        .catch(error => {
          console.error("Error fetching payment methods:", error);
          // Fallback to static list
          setAvailablePaymentMethods(getCoinbasePaymentMethods(selectedRampType));
        })
        .finally(() => {
          setLoadingPaymentMethods(false);
        });
    } else {
      setAvailablePaymentMethods([]);
    }
  }, [selectedProvider, selectedRampType, profile?.walletAddress]);

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

  // Query blockchain transactions
  const { data: blockchainTxs, refetch: refetchBlockchainTxs, isLoading: loadingBlockchainTxs } = useQuery({
    queryKey: ["blockchainTransactions", profile?.walletAddress],
    queryFn: () => {
      if (!profile?.walletAddress) throw new Error("No wallet");
      return getUsdcTransactions(profile.walletAddress as `0x${string}`);
    },
    enabled: hasBaseWallet,
    refetchInterval: 15000, // Refetch every 15 seconds
  });
  
  const {
    data: pendingTransfers = [],
    isFetching: loadingPendingTransfers,
    refetch: refetchPendingTransfers,
  } = useQuery<PendingTransferSummary[]>({
    queryKey: ["pendingTransfers", profile?.email],
    enabled: Boolean(profile?.email),
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!profile?.email) return [];
      return pendingTransferService.getPendingTransfers(profile.email);
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (hasBaseWallet) {
        refetch();
        refetchBalance();
        refetchBlockchainTxs();
        refetchPendingTransfers();
      }
    }, [hasBaseWallet, refetch, refetchBalance, refetchBlockchainTxs, refetchPendingTransfers])
  );

  // Fetch FX rate when currency changes
  useEffect(() => {
    fetchFxRate(userCurrency);
  }, [userCurrency]);

  // Auto-detect location on mount
  useEffect(() => {
    const initializeLocation = async () => {
      const permission = await checkLocationPermission();
      setLocationPermission(permission);
      
      if (permission === 'granted') {
        const location = await getUserLocation();
        if (location) {
          setUserCountry(location.country);
          setUserCountryCode(location.countryCode);
          const currencyData = getCurrencyFromCountryCode(location.countryCode);
          setUserCurrency(currencyData.currency);
          setCurrencySymbol(currencyData.symbol);
        }
      }
    };
    
    initializeLocation();
  }, []);

  const handleBuyFunds = () => {
    setSelectedRampType("onramp");
    setIsExchangeModalVisible(false);
  };

  const handleWithdraw = () => {
    setSelectedRampType("offramp");
    setIsExchangeModalVisible(false);
  };

  const handleProviderSelect = (provider: RampProvider) => {
    setSelectedProvider(provider);
    const info = getProviderInfo(provider);
    
    if (info.supportsPaymentMethods) {
      setSelectedPaymentMethod(null);
    } else {
      openRamp(provider, null);
    }
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    if (selectedProvider) {
      openRamp(selectedProvider, method);
    }
  };

  const openRamp = (provider: RampProvider, paymentMethod: PaymentMethod | null) => {
    if (!profile?.walletAddress) {
      console.error("No wallet address available");
      return;
    }
    setShowWebView(true);
  };

  const closeRamp = () => {
    setShowWebView(false);
    setWebViewLoading(true);
    setSelectedRampType(null);
    setSelectedProvider(null);
    setSelectedPaymentMethod(null);
  };

  // Combined activity list (blockchain transactions + app transfers)
  type Activity = 
    | { type: "app-transfer"; data: TransferRecord; timestamp: number }
    | { type: "blockchain-tx"; data: BlockchainTransaction; timestamp: number };

  const activities = useMemo<Activity[]>(() => {
    const appActivities: Activity[] = (transfers ?? []).map(t => ({
      type: "app-transfer" as const,
      data: t,
      timestamp: new Date(t.createdAt).getTime(),
    }));

    const blockchainActivities: Activity[] = (blockchainTxs ?? []).map(tx => ({
      type: "blockchain-tx" as const,
      data: tx,
      timestamp: tx.timestamp,
    }));

    // Combine and sort by timestamp (newest first)
    return [...appActivities, ...blockchainActivities]
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [transfers, blockchainTxs]);

  // Claimable transfers removed - users claim via web link from email only



  const renderActivity = ({ item }: ListRenderItemInfo<Activity>) => {
    if (item.type === "app-transfer") {
      const transfer = item.data;
      return (
        <View style={styles.transferRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.transferEmail}>{transfer.intent.recipientEmail}</Text>
            <Text style={styles.transferMeta}>
              {transfer.status === "sent" ? "Sent" : "Pending signup"} · {formatRelativeDate(transfer.createdAt)}
            </Text>
            {transfer.recipientWallet ? (
              <Text style={styles.transferMeta}>Wallet: {formatShortAddress(transfer.recipientWallet)}</Text>
            ) : null}
            {transfer.redemptionCode ? (
              <Text style={styles.transferMeta}>Redemption code: {transfer.redemptionCode}</Text>
            ) : null}
          </View>
          <Text style={styles.transferAmount}>-{transfer.intent.amountUsdc.toFixed(2)} USDC</Text>
        </View>
      );
    } else {
      const tx = item.data;
      return (
        <View style={styles.transferRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.transferEmail}>
              {tx.type === "sent" ? "To: " : "From: "}
              {tx.type === "sent" ? formatShortAddress(tx.to) : formatShortAddress(tx.from)}
            </Text>
            <Text style={styles.transferMeta}>
              {tx.type === "sent" ? "Sent" : "Received"} · {formatRelativeDate(tx.timestamp)}
            </Text>
            <Text style={styles.transferMeta}>Tx: {formatShortAddress(tx.hash)}</Text>
          </View>
          <Text style={[styles.transferAmount, tx.type === "received" && styles.transferAmountReceived]}>
            {tx.type === "sent" ? "-" : "+"}{tx.value.toFixed(2)} USDC
          </Text>
        </View>
      );
    }
  };

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

  const copyWalletAddress = () => {
    if (profile?.walletAddress) {
      Clipboard.setString(profile.walletAddress);
      Alert.alert("Copied!", "Wallet address copied to clipboard");
    }
  };

  const handleLocationIconPress = () => {
    setIsLocationModalVisible(true);
  };

  const handleRequestLocation = async () => {
    const status = await requestLocationPermission();
    setLocationPermission(status);
    
    if (status === 'granted') {
      const location = await getUserLocation();
      if (location) {
        setUserCountry(location.country);
        setUserCountryCode(location.countryCode);
        const currencyData = getCurrencyFromCountryCode(location.countryCode);
        setUserCurrency(currencyData.currency);
        setCurrencySymbol(currencyData.symbol);
        await fetchFxRate(currencyData.currency);
        
        // Refresh providers if on withdraw screen
        if (selectedRampType) {
          getAvailableProviders(selectedRampType).then(providers => {
            setAvailableProviders(providers);
          });
        }
        
        setIsLocationModalVisible(false);
        Alert.alert(
          "Location Access Granted",
          `Your location is set to ${location.country}. Currency updated to ${currencyData.currency}. This helps us show relevant payment providers.`
        );
      }
    } else if (status === 'denied') {
      Alert.alert(
        "Location Access Denied",
        "Please enable location access in your device settings to see region-specific payment options and currency."
      );
    }
  };

  return (
    <>
      <View style={styles.container}>
      {/* Home Screen */}
      {activeTab === "home" && (
        <>
      <View style={styles.heroCard}>
        <View style={styles.profileRow}>
          <View style={styles.profileDetails}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{profile?.displayName ?? profile?.email}</Text>
          </View>
          <TouchableOpacity style={styles.locationIcon} onPress={handleLocationIconPress}>
            <Text style={styles.locationEmoji}>📍</Text>
            {userCountryCode && (
              <Text style={styles.locationText}>{userCountryCode}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            {loadingBalance ? "..." : usdcBalance !== undefined ? `${currencySymbol}${(usdcBalance * fxRate).toFixed(2)}` : `${currencySymbol}0.00`}
          </Text>
          <Text style={styles.balanceSubtext}>
            {usdcBalance !== undefined && fxRate !== 1 ? `≈ $${usdcBalance.toFixed(2)} USDC · ` : ''}Base Sepolia
          </Text>
        </View>
        <TouchableOpacity style={styles.walletPill} onPress={copyWalletAddress} activeOpacity={0.7}>
          <Text style={styles.walletLabel}>📍 Wallet</Text>
          <Text style={styles.walletAddress}>
            {profile && profile.walletAddress
              ? hasBaseWallet
                ? formatShortAddress(profile.walletAddress)
                : "Base wallet pending"
              : "-"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Claimable transfers removed - users claim via web link from email only */}

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("Send")}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>📤</Text>
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={handleBuyFunds}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>💳</Text>
          </View>
          <Text style={styles.actionLabel}>Add Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={handleWithdraw}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>💰</Text>
          </View>
          <Text style={styles.actionLabel}>Withdraw</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => setIsMoreFeaturesModalVisible(true)}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>✨</Text>
          </View>
          <Text style={styles.actionLabel}>More</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Text style={styles.sectionSubtitle}>Latest activity on your wallet</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={hasBaseWallet ? activities.slice(0, 5) : []}
        keyExtractor={(item, index) => `${item.type}-${item.type === "app-transfer" ? item.data.id : item.data.hash}-${index}`}
        renderItem={renderActivity}
        style={styles.list}
        contentContainerStyle={styles.listContentHome}
        ListEmptyComponent={
          <Text style={styles.emptyState}>
            {!hasBaseWallet
              ? "Connect your wallet to view transactions"
              : isLoading || loadingBlockchainTxs
              ? "Loading transactions..."
              : "No transactions yet"}
          </Text>
        }
      />

        </>
      )}

      {/* More Features Modal */}
      <Modal
        visible={isMoreFeaturesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMoreFeaturesModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsMoreFeaturesModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>More Features</Text>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('TransactionHistory');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📊</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Transaction History</Text>
                <Text style={styles.modalOptionSubtitle}>View all your transactions</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Tipping');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>💸</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Micro-Tipping</Text>
                <Text style={styles.modalOptionSubtitle}>Send tips to creators</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('PaymentRequests');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📧</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Payment Requests</Text>
                <Text style={styles.modalOptionSubtitle}>Request payments via email</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Invoices');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📄</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Invoices</Text>
                <Text style={styles.modalOptionSubtitle}>Create professional invoices</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Gifts');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>🎁</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Crypto Gifts</Text>
                <Text style={styles.modalOptionSubtitle}>Send themed crypto gifts</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setIsMoreFeaturesModalVisible(false)}
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

      {/* Location Modal */}
      <Modal
        visible={isLocationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLocationModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsLocationModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Location & Currency</Text>
            
            <View style={styles.locationInfoContainer}>
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Current Location:</Text>
                <Text style={styles.locationInfoValue}>{userCountry || 'Not set'}</Text>
              </View>
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Display Currency:</Text>
                <Text style={styles.locationInfoValue}>{userCurrency} ({currencySymbol})</Text>
              </View>
              {fxRate !== 1 && (
                <View style={styles.locationInfoRow}>
                  <Text style={styles.locationInfoLabel}>Exchange Rate:</Text>
                  <Text style={styles.locationInfoValue}>1 USD = {fxRate.toFixed(4)} {userCurrency}</Text>
                </View>
              )}
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Permission Status:</Text>
                <Text style={[styles.locationInfoValue, locationPermission === 'granted' ? styles.permissionGranted : styles.permissionDenied]}>
                  {locationPermission === 'granted' ? '✓ Granted' : locationPermission === 'denied' ? '✗ Denied' : '⊙ Not Set'}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsLocationModalVisible(false);
                handleRequestLocation();
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📍</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Update Location</Text>
                <Text style={styles.modalOptionSubtitle}>Use GPS to detect your location</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setIsLocationModalVisible(false)}
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

      {/* More Features Modal */}
      <Modal
        visible={isMoreFeaturesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMoreFeaturesModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsMoreFeaturesModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>More Features</Text>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('TransactionHistory');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📊</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Transaction History</Text>
                <Text style={styles.modalOptionSubtitle}>View all your transactions</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Tipping');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>💸</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Micro-Tipping</Text>
                <Text style={styles.modalOptionSubtitle}>Send tips to creators</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('PaymentRequests');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📧</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Payment Requests</Text>
                <Text style={styles.modalOptionSubtitle}>Request payments via email</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Invoices');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📄</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Invoices</Text>
                <Text style={styles.modalOptionSubtitle}>Create professional invoices</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsMoreFeaturesModalVisible(false);
                navigation.navigate('Gifts');
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>🎁</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Crypto Gifts</Text>
                <Text style={styles.modalOptionSubtitle}>Send themed crypto gifts</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setIsMoreFeaturesModalVisible(false)}
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

      {/* Location Modal */}
      <Modal
        visible={isLocationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLocationModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsLocationModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Location & Currency</Text>
            
            <View style={styles.locationInfoContainer}>
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Current Location:</Text>
                <Text style={styles.locationInfoValue}>{userCountry || 'Not set'}</Text>
              </View>
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Display Currency:</Text>
                <Text style={styles.locationInfoValue}>{userCurrency} ({currencySymbol})</Text>
              </View>
              {fxRate !== 1 && (
                <View style={styles.locationInfoRow}>
                  <Text style={styles.locationInfoLabel}>Exchange Rate:</Text>
                  <Text style={styles.locationInfoValue}>1 USD = {fxRate.toFixed(4)} {userCurrency}</Text>
                </View>
              )}
              <View style={styles.locationInfoRow}>
                <Text style={styles.locationInfoLabel}>Permission Status:</Text>
                <Text style={[styles.locationInfoValue, locationPermission === 'granted' ? styles.permissionGranted : styles.permissionDenied]}>
                  {locationPermission === 'granted' ? '✓ Granted' : locationPermission === 'denied' ? '✗ Denied' : '⊙ Not Set'}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsLocationModalVisible(false);
                handleRequestLocation();
              }}
            >
              <View style={styles.modalOptionIcon}>
                <Text style={styles.modalOptionEmoji}>📍</Text>
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Update Location</Text>
                <Text style={styles.modalOptionSubtitle}>Use GPS to detect your location</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setIsLocationModalVisible(false)}
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
              onPress={handleBuyFunds}
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
              onPress={handleWithdraw}
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

      {/* Ramp Provider Selection Modal */}
      <Modal
        visible={selectedRampType !== null && !showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeRamp}
      >
        <View style={styles.rampModalContainer}>
          <View style={styles.rampModalHeader}>
            <Text style={styles.rampModalTitle}>
              {selectedRampType === "onramp" ? "Buy Crypto" : "Withdraw to Bank"}
            </Text>
            <Pressable style={styles.closeButton} onPress={closeRamp}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.rampScrollView} showsVerticalScrollIndicator={false}>
            {/* Provider Selection */}
            {!selectedProvider && (
              <>
                <Text style={styles.rampSectionTitle}>Select Provider</Text>
                {availableProviders.map((provider) => {
                  const info = getProviderInfo(provider);
                  const canUse = selectedRampType === "onramp" ? info.supportsBuy : info.supportsSell;
                  
                  if (!canUse) return null;

                  return (
                    <TouchableOpacity
                      key={provider}
                      style={styles.rampProviderCard}
                      onPress={() => handleProviderSelect(provider)}
                    >
                      <View style={styles.rampProviderHeader}>
                        <Text style={styles.rampProviderLogo}>{info.logo}</Text>
                        <Text style={styles.rampProviderName}>{info.name}</Text>
                      </View>
                      <Text style={styles.rampProviderDescription}>{info.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Payment Method Selection (Coinbase only) */}
            {selectedProvider === "coinbase" && (
              <>
                <Pressable style={styles.backButton} onPress={() => setSelectedProvider(null)}>
                  <Text style={styles.backButtonText}>← Back to providers</Text>
                </Pressable>
                
                <Text style={styles.rampSectionTitle}>Select Payment Method</Text>
                
                {loadingPaymentMethods ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading payment methods...</Text>
                  </View>
                ) : availablePaymentMethods.length > 0 ? (
                  availablePaymentMethods.map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={styles.rampProviderCard}
                      onPress={() => handlePaymentMethodSelect(method)}
                    >
                      <Text style={styles.rampProviderName}>{getPaymentMethodName(method)}</Text>
                      <Text style={styles.rampProviderDescription}>{getPaymentMethodDescription(method)}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No payment methods available for your region</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* In-App WebView Modal for Ramp */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeRamp}
      >
        <View style={styles.webViewModalContainer}>
          <View style={styles.webViewModalHeader}>
            <Text style={styles.webViewModalTitle}>
              {selectedProvider && getProviderInfo(selectedProvider).name}
            </Text>
            <Pressable style={styles.closeButton} onPress={closeRamp}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          {webViewLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
          
          {profile?.walletAddress && selectedProvider && selectedRampType && (
            <WebView
              source={{ uri: buildRampUrl({
                provider: selectedProvider,
                type: selectedRampType,
                walletAddress: profile.walletAddress,
                assetSymbol: "USDC",
                destinationNetwork: "base",
                paymentMethod: selectedPaymentMethod ?? undefined,
              }) }}
              style={styles.webView}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView error:", nativeEvent);
                setWebViewLoading(false);
              }}
            />
          )}
        </View>
      </Modal>

      {/* Currency Selector Modal */}
      <Modal
        visible={isCurrencySelectorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCurrencySelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.rampModalHeader}>
              <Text style={styles.rampModalTitle}>Select Display Currency</Text>
              <Pressable onPress={() => setIsCurrencySelectorVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
              {popularCurrencies.map((curr) => (
                <TouchableOpacity
                  key={curr.currency}
                  style={[
                    styles.currencyOption,
                    userCurrency === curr.currency && styles.currencyOptionActive
                  ]}
                  onPress={() => handleCurrencySelect(curr)}
                  activeOpacity={0.7}
                >
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                    <View style={styles.currencyDetails}>
                      <Text style={styles.currencyCode}>{curr.currency}</Text>
                      <Text style={styles.currencyName}>{curr.name}</Text>
                    </View>
                  </View>
                  {userCurrency === curr.currency && (
                    <Text style={styles.currencyCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Screen */}
      {activeTab === "settings" && (
        <View style={styles.settingsContainer}>
          <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Appearance</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Theme</Text>
                  <Text style={styles.settingDescription}>Choose your preferred theme</Text>
                </View>
              </View>
              
              <View style={styles.themeSelector}>
                <TouchableOpacity
                  style={[styles.themeOption, scheme === "light" && styles.themeOptionActive]}
                  onPress={() => setScheme("light")}
                >
                  <Text style={styles.themeOptionIcon}>☀️</Text>
                  <Text style={[styles.themeOptionText, scheme === "light" && styles.themeOptionTextActive]}>Light</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.themeOption, scheme === "dark" && styles.themeOptionActive]}
                  onPress={() => setScheme("dark")}
                >
                  <Text style={styles.themeOptionIcon}>🌙</Text>
                  <Text style={[styles.themeOptionText, scheme === "dark" && styles.themeOptionTextActive]}>Dark</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Location</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Location Access</Text>
                  <Text style={styles.settingDescription}>
                    {locationPermission === 'granted' 
                      ? `Enabled - ${userCountry || 'Detecting...'}` 
                      : locationPermission === 'denied'
                      ? 'Denied - Limited payment options'
                      : 'Not enabled - Using device locale'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.settingRow}
                onPress={() => setIsCurrencySelectorVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Display Currency</Text>
                  <Text style={styles.settingDescription}>
                    {userCurrency} ({currencySymbol})
                  </Text>
                </View>
                <Text style={styles.settingArrow}>→</Text>
              </TouchableOpacity>
              
              {locationPermission !== 'granted' && (
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={handleRequestLocation}
                >
                  <Text style={styles.locationButtonText}>Enable Location Access</Text>
                  <Text style={styles.locationButtonSubtext}>
                    Get accurate currency and access to region-specific payment providers
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Account</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Email</Text>
                  <Text style={styles.settingDescription}>{profile?.email ?? "Not set"}</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.settingRow} onPress={copyWalletAddress} activeOpacity={0.7}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Wallet Address</Text>
                  <Text style={styles.settingDescription}>{profile?.walletAddress ? formatShortAddress(profile.walletAddress) : "Not connected"}</Text>
                </View>
                {profile?.walletAddress && <Text style={styles.settingCopy}>📋</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <TouchableOpacity style={styles.settingRow} onPress={disconnect}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: "#EF4444" }]}>Sign Out</Text>
                </View>
                <Text style={styles.settingArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Bottom Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("home")}
        >
          <View style={[styles.tabIconContainer, activeTab === "home" && styles.tabIconContainerActive]}>
            <Text style={[styles.tabIcon, activeTab === "home" && styles.tabIconActive]}>🏠</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItemCenter}
          onPress={() => setIsExchangeModalVisible(true)}
        >
          <View style={styles.centerTabButton}>
            <Text style={styles.centerTabIcon}>+</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("settings")}
        >
          <View style={[styles.tabIconContainer, activeTab === "settings" && styles.tabIconContainerActive]}>
            <Text style={[styles.tabIcon, activeTab === "settings" && styles.tabIconActive]}>⚙️</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === "settings" && styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
      <ToastModal
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={hideToast}
      />
    </>
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
      borderRadius: 28,
      padding: spacing.xl,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
      borderWidth: 1,
      borderColor: `${colors.primary}20`,
    },
    // Removed pendingTransfersCard styles - users claim via web only
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xl,
    },
    profileDetails: {
      flex: 1,
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
      fontSize: 48,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      letterSpacing: -1,
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
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    quickActions: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.lg,
    },
    actionCard: {
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
    },
    actionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.cardBackground,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: `${colors.border}50`,
    },
    actionIcon: {
      fontSize: 20,
    },
    actionLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "600",
    },
    sectionHeader: {
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    seeAllText: {
      ...typography.body,
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    list: {
      flex: 1,
    },
    listContent: {
      rowGap: spacing.md,
      paddingBottom: 100,
      paddingHorizontal: spacing.lg,
    },
    listContentHome: {
      rowGap: spacing.md,
      paddingBottom: 20,
      paddingHorizontal: spacing.lg,
    },
    transferRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      padding: spacing.lg,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: `${colors.border}40`,
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
    transferAmountReceived: {
      color: "#10B981", // Green for received
    },
    emptyState: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xl,
      fontSize: 14,
    },
    locationIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    locationEmoji: {
      fontSize: 16,
    },
    locationText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    locationInfoContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      gap: 12,
    },
    locationInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    locationInfoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    locationInfoValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    permissionGranted: {
      color: '#4ade80',
    },
    permissionDenied: {
      color: '#f87171',
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
    // Ramp Modal Styles
    rampModalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    rampModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    rampModalTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    closeButtonText: {
      fontSize: 18,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    rampScrollView: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    rampSectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: spacing.md,
    },
    rampProviderCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    rampProviderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    rampProviderLogo: {
      fontSize: 28,
    },
    rampProviderName: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "600",
    },
    rampProviderDescription: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: spacing.xs,
    },
    backButton: {
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    backButtonText: {
      ...typography.body,
      color: colors.primary,
      fontSize: 15,
      fontWeight: "500",
    },
    webViewModalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    webViewModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    webViewModalTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
    },
    webView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      zIndex: 10,
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.lg,
      marginHorizontal: spacing.lg,
    },
    // Tab Bar Styles
    tabBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      flexDirection: "row",
      backgroundColor: colors.cardBackground,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingBottom: spacing.sm,
      paddingTop: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 10,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tabItemCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    tabIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    tabIconContainerActive: {
      backgroundColor: `${colors.primary}18`,
    },
    tabIcon: {
      fontSize: 26,
      opacity: 0.6,
    },
    tabIconActive: {
      opacity: 1,
    },
    tabLabel: {
      ...typography.body,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: "600",
    },
    centerTabButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 16,
      marginTop: -32,
      borderWidth: 4,
      borderColor: colors.background,
    },
    centerTabIcon: {
      fontSize: 36,
      fontWeight: "300",
      color: "#FFFFFF",
      lineHeight: 36,
    },
    // Settings Screen Styles
    settingsContainer: {
      flex: 1,
      paddingBottom: 90,
    },
    settingsScroll: {
      flex: 1,
    },
    settingsSection: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingsSectionTitle: {
      ...typography.subtitle,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 2,
    },
    settingDescription: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
    },
    settingArrow: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    settingCopy: {
      fontSize: 18,
      color: colors.textSecondary,
      opacity: 0.6,
    },

    // Currency Selector Modal Styles
    currencyList: {
      flex: 1,
    },
    currencyOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 2,
      borderColor: "transparent",
    },
    currencyOptionActive: {
      borderColor: "#3B82F6",
      backgroundColor: colors.background,
    },
    currencyInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    currencySymbol: {
      fontSize: 32,
      width: 40,
      textAlign: "center",
    },
    currencyDetails: {
      gap: 2,
    },
    currencyCode: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    currencyName: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    currencyCheckmark: {
      fontSize: 24,
      color: "#3B82F6",
      fontWeight: "bold",
    },
    themeSelector: {
      flexDirection: "row",
      gap: spacing.md,
    },
    themeOption: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    themeOptionIcon: {
      fontSize: 20,
    },
    themeOptionText: {
      ...typography.body,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    themeOptionTextActive: {
      color: colors.primary,
    },
    locationButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      alignItems: "center",
    },
    locationButtonText: {
      ...typography.body,
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
    locationButtonSubtext: {
      ...typography.body,
      color: "#FFFFFF",
      fontSize: 12,
      opacity: 0.8,
      marginTop: spacing.xs,
      textAlign: "center",
    },
  });
