import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useCoinbase } from "../providers/CoinbaseProvider";
import { useTheme } from "../providers/ThemeProvider";
import { SignInScreen } from "../screens/Auth/SignInScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SendScreen } from "../screens/Send/SendScreen";
import { OffRampScreen } from "../screens/OffRampScreen";

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  Send: undefined;
  OffRamp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isConnected, loading } = useCoinbase();
  const { colors, scheme } = useTheme();

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isConnected ? (
        <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "MetaSend" }} />
          <Stack.Screen name="Send" component={SendScreen} options={{ title: "Send USDC" }} />
          <Stack.Screen name="OffRamp" component={OffRampScreen} options={{ title: "On / Off Ramp" }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

