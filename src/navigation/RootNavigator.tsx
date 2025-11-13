import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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

const RETURNING_USER_KEY = "is_returning_user";
const BIOMETRIC_AUTH_KEY = "biometric_authenticated";

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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isConnected, loading, profile, disconnect } = useCoinbase();
  const { colors, scheme } = useTheme();
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [needsBiometric, setNeedsBiometric] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkReturningUser();
  }, []);

  useEffect(() => {
    if (isConnected && !loading) {
      checkBiometricStatus();
    }
  }, [isConnected, loading]);

  const checkReturningUser = async () => {
    try {
      const returning = await AsyncStorage.getItem(RETURNING_USER_KEY);
      setIsReturningUser(returning === "true");
    } catch (error) {
      console.error("Error checking returning user:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const checkBiometricStatus = async () => {
    try {
      const biometricAuth = await AsyncStorage.getItem(BIOMETRIC_AUTH_KEY);
      if (isReturningUser && !biometricAuth) {
        setNeedsBiometric(true);
      } else {
        setNeedsBiometric(false);
        // Mark as returning user after first successful login
        await AsyncStorage.setItem(RETURNING_USER_KEY, "true");
      }
    } catch (error) {
      console.error("Error checking biometric status:", error);
      setNeedsBiometric(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setNeedsBiometric(false);
    await AsyncStorage.setItem(RETURNING_USER_KEY, "true");
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem(BIOMETRIC_AUTH_KEY);
    await AsyncStorage.removeItem(RETURNING_USER_KEY);
    setNeedsBiometric(false);
    setIsReturningUser(false);
    disconnect();
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

  // Show biometric unlock for returning users
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
    <NavigationContainer theme={navigationTheme}>
      {isConnected ? (
        <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "MetaSend" }} />
          <Stack.Screen name="Send" component={SendScreen} options={{ title: "Send USDC" }} />
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
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

