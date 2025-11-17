import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { SignInScreen } from "../screens/Auth/SignInScreen";
import { BiometricUnlockScreen } from "../screens/Auth/BiometricUnlockScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SendScreen } from "../screens/Send/SendScreen";
import { OffRampScreen } from "../screens/OffRampScreen";
import { TransactionHistoryScreen } from "../screens/TransactionHistoryScreen";
import { TippingScreen } from "../screens/TippingScreen";
import { PaymentRequestsScreen } from "../screens/PaymentRequestsScreen";
import { InvoicesScreen } from "../screens/InvoicesScreen";
import { GiftsScreen } from "../screens/GiftsScreen";
import { ClaimScreen } from "../screens/Claim/ClaimScreen";
import { RETURNING_USER_KEY, BIOMETRIC_AUTH_KEY } from "../constants/auth";

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  Send: undefined;
  OffRamp: undefined;
  TransactionHistory: undefined;
  Tipping: undefined;
  PaymentRequests: undefined;
  Invoices: undefined;
  Gifts: undefined;
  Claim: { transferId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isConnected, loading, profile, disconnect } = useCoinbase();
  const { colors, scheme } = useTheme();
  const [isReturningUser, setIsReturningUser] = useState<boolean | null>(null);
  const [needsBiometric, setNeedsBiometric] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const syncReturningUserFlag = useCallback(async () => {
    try {
      const returning = await AsyncStorage.getItem(RETURNING_USER_KEY);
      setIsReturningUser(returning === "true");
    } catch (error) {
      console.error("Error checking returning user:", error);
      setIsReturningUser(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        await AsyncStorage.removeItem(BIOMETRIC_AUTH_KEY);
        await syncReturningUserFlag();
      } finally {
        setCheckingAuth(false);
      }
    };

    initialize();
  }, [syncReturningUserFlag]);

  useEffect(() => {
    if (!isConnected && !loading) {
      setNeedsBiometric(false);
      syncReturningUserFlag();
    }
  }, [isConnected, loading, syncReturningUserFlag]);

  useEffect(() => {
    if (isConnected && !loading && isReturningUser !== null) {
      markAsReturningUser();
      checkBiometricStatus();
    }
  }, [isConnected, loading, isReturningUser]);

  const markAsReturningUser = async () => {
    try {
      await AsyncStorage.setItem(RETURNING_USER_KEY, "true");
      if (isReturningUser === false) {
        setIsReturningUser(true);
      }
    } catch (error) {
      console.error("Error marking returning user:", error);
    }
  };

  const checkBiometricStatus = async () => {
    try {
      const biometricAuth = await AsyncStorage.getItem(BIOMETRIC_AUTH_KEY);
      // If user is returning and hasn't authenticated this session
      if (isReturningUser && !biometricAuth) {
        setNeedsBiometric(true);
      } else {
        setNeedsBiometric(false);
      }
    } catch (error) {
      console.error("Error checking biometric status:", error);
      setNeedsBiometric(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setNeedsBiometric(false);
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.multiRemove([BIOMETRIC_AUTH_KEY, RETURNING_USER_KEY]);
    } catch (error) {
      console.warn("Failed to clear auth flags on sign out", error);
    }

    setNeedsBiometric(false);
    setIsReturningUser(false);

    try {
      await disconnect();
      Alert.alert("Signed out", "You can now sign in with a different account.");
    } catch (error) {
      console.warn("Disconnect error", error);
    }
  };

  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;

  const navigationTheme = useMemo<Theme>(
    () => ({
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.cardBackground,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [baseTheme, colors]
  );

  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.cardBackground },
      headerTintColor: colors.textPrimary,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors]
  );

  if (loading || checkingAuth) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show biometric unlock for connected returning users who need to authenticate
  if (isConnected && needsBiometric) {
    return (
      <BiometricUnlockScreen
        onUnlock={handleBiometricUnlock}
        onSignOut={handleSignOut}
        userEmail={profile?.email}
      />
    );
  }

  return (
    <NavigationContainer 
      theme={navigationTheme}
      linking={{
        prefixes: ['metasend://', 'https://metasend.vercel.app'],
        config: {
          screens: {
            SignIn: 'signin',
            Home: 'home',
            Send: 'send',
            Claim: 'claim/:transferId',
            OffRamp: 'offramp',
            TransactionHistory: 'history',
            Tipping: 'tipping',
            PaymentRequests: 'payment-requests',
            Invoices: 'invoices',
            Gifts: 'gifts',
          },
        },
      }}
    >
      {isConnected ? (
        <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "MetaSend" }} />
          <Stack.Screen name="Send" component={SendScreen} options={{ title: "Send USDC" }} />
          <Stack.Screen name="Claim" component={ClaimScreen} options={{ title: "Claim Transfer" }} />
          <Stack.Screen name="OffRamp" component={OffRampScreen} options={{ title: "On / Off Ramp" }} />
          <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Tipping" component={TippingScreen} options={{ title: "Tipping" }} />
          <Stack.Screen name="PaymentRequests" component={PaymentRequestsScreen} options={{ title: "Payment Requests" }} />
          <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: "Invoices" }} />
          <Stack.Screen name="Gifts" component={GiftsScreen} options={{ title: "Gifts" }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen 
            name="Claim" 
            component={ClaimScreen} 
            options={{ headerShown: true, title: "Claim Transfer" }} 
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

