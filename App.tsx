// Crypto polyfills are handled in index.ts
// Do not import polyfills here to avoid hoisting issues
import "./globals";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Web3AuthProvider } from "./src/providers/Web3AuthProvider";
import { ThemeProvider, useTheme } from "./src/providers/ThemeProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Web3AuthProvider>
          <SafeAreaProvider>
            <ThemedAppShell />
          </SafeAreaProvider>
        </Web3AuthProvider>
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
