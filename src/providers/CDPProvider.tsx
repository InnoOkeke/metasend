import React, { PropsWithChildren } from "react";
import { CDPHooksProvider } from "@coinbase/cdp-hooks";
import Constants from "expo-constants";
import { Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

// Load from environment variables only - no hardcoded fallback
const CDP_PROJECT_ID = 
  Constants.expoConfig?.extra?.cdpProjectId || 
  Constants.expoConfig?.extra?.coinbaseAppId;

console.log("🔧 CDP Provider Initializing with Project ID:", CDP_PROJECT_ID);

// Configure OAuth callback for React Native
const nativeOAuthCallback = async (url: string) => {
  try {
    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: Constants.expoConfig?.extra?.coinbaseRedirectScheme || "metasend",
      preferLocalhost: false,
    });

    console.log("🔐 Starting OAuth flow with redirect:", redirectUrl);
    
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    
    if (result.type === "success" && result.url) {
      console.log("✅ OAuth callback received:", result.url);
      return result.url;
    }
    
    console.warn("⚠️ OAuth flow cancelled or failed:", result.type);
    throw new Error("OAuth flow was cancelled");
  } catch (error) {
    console.error("❌ OAuth callback error:", error);
    throw error;
  }
};

export const CDPProvider: React.FC<PropsWithChildren> = ({ children }) => {
  if (!CDP_PROJECT_ID || CDP_PROJECT_ID.length < 10) {
    console.error("❌ Invalid CDP_PROJECT_ID");
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>
          CDP Configuration Error: Invalid Project ID
        </Text>
      </View>
    );
  }

  return (
    <CDPHooksProvider
      config={{
        projectId: CDP_PROJECT_ID,
        ethereum: {
          createOnLogin: "smart", // Create smart accounts with ERC-4337
          enableSpendPermissions: true,
        },
        // Type definitions expect a string, but the runtime SDK supports a callback function.
        nativeOAuthCallback: nativeOAuthCallback as unknown as string,
      }}
    >
      {children}
    </CDPHooksProvider>
  );
};
