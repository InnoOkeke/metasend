import "react-native-gesture-handler";

import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CDPProvider } from "./src/providers/CDPProvider";
import { CoinbaseProvider } from "./src/providers/CoinbaseProvider";
import { PaymasterProvider } from "./src/providers/PaymasterProvider";
import { ThemeProvider, useTheme } from "./src/providers/ThemeProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CDPProvider>
          <CoinbaseProvider>
            <PaymasterProvider>
              <SafeAreaProvider>
                <ThemedAppShell />
              </SafeAreaProvider>
            </PaymasterProvider>
          </CoinbaseProvider>
        </CDPProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const ThemedAppShell: React.FC = () => {
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
};
