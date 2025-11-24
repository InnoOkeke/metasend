import 'react-native-quick-crypto';
// Ensure our crypto shim is applied early so browserCrypto.randomBytes exists
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cryptoShim = require('./src/crypto-polyfill').default || require('./src/crypto-polyfill');
  if (!global.crypto) {
    (global as any).crypto = cryptoShim;
  } else if (!(global as any).crypto.randomBytes) {
    (global as any).crypto.randomBytes = cryptoShim.randomBytes;
  }
  // expose browserCrypto alias expected by some libraries
  (global as any).browserCrypto = (global as any).crypto;
} catch (e) {
  // ignore if shim not available yet
}
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
