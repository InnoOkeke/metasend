import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSignInWithEmail, useVerifyEmailOTP, useIsSignedIn, CDPContext } from "@coinbase/cdp-hooks";

import { PrimaryButton } from "../../components/PrimaryButton";
import { useTheme } from "../../providers/ThemeProvider";
import type { ColorPalette } from "../../utils/theme";
import { typography } from "../../utils/theme";

type AuthMethod = "email";
type AuthStep = "method" | "otp";

export const SignInScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const cdpContext = React.useContext(CDPContext);
  const { isSignedIn } = useIsSignedIn();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  
  const [step, setStep] = useState<AuthStep>("method");
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if CDP is initialized
  React.useEffect(() => {
    if (!cdpContext) {
      setError("Wallet SDK not initialized. Please check your configuration.");
    }
  }, [cdpContext]);

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    
    setError(null);
    setLoading(true);
    setAuthMethod("email");
    
    try {
      const result = await signInWithEmail({ email: email.trim() });
      setFlowId(result.flowId);
      setStep("otp");
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(err instanceof Error ? err.message : "Failed to send verification email");
      setAuthMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp.trim()) {
      setError("Please enter the verification code");
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      await verifyEmailOTP({ flowId, otp: otp.trim() });
      // User will be signed in, isSignedIn will become true
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  if (isSignedIn && cdpContext?.currentUser) {
    const walletAddress = cdpContext.currentUser.evmSmartAccounts?.[0];
    const authMethods = cdpContext.currentUser.authenticationMethods;
    const userEmail = authMethods.email?.email || authMethods.google?.email || authMethods.apple?.email;
    
    return (
      <View style={styles.container}>
        <Text style={styles.title}>✅ Signed In</Text>
        <Text style={styles.subtitle}>Smart account: {walletAddress || "Unavailable"}</Text>
        {userEmail && <Text style={styles.subtitle}>Email: {userEmail}</Text>}
        <Text style={styles.subtitle}>User ID: {cdpContext.currentUser.userId}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MetaSend</Text>
      <Text style={styles.subtitle}>Send USDC to any email. Base Sepolia testnet, gasless via Coinbase Paymaster.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>
        <Text style={styles.cardBody}>
          Sign in with email to create your embedded smart wallet.
        </Text>
        
        {step === "method" && (
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
            <PrimaryButton
              title="Continue with Email"
              onPress={handleEmailSubmit}
              loading={loading && authMethod === "email"}
              disabled={loading}
            />
          </View>
        )}

        {step === "otp" && (
          <>
            <Text style={styles.otpInfo}>
              We sent a verification code to {email}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.textSecondary}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <PrimaryButton
              title="Verify Code"
              onPress={handleOtpSubmit}
              loading={loading}
            />
            <TouchableOpacity
              onPress={() => {
                setStep("method");
                setOtp("");
                setError(null);
                setAuthMethod(null);
              }}
              disabled={loading}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back to sign in</Text>
            </TouchableOpacity>
          </>
        )}

        {loading && (
          <View style={styles.hintRow}>
            <ActivityIndicator color={colors.textSecondary} size="small" />
            <Text style={styles.hintText}>
              {authMethod === "email" && step === "method" && "Sending verification email..."}
              {authMethod === "email" && step === "otp" && "Verifying code..."}
            </Text>
          </View>
        )}
        
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: colors.background,
      paddingVertical: 32,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 32,
      maxWidth: 320,
    },
    card: {
      width: "100%",
      backgroundColor: colors.cardBackground,
      padding: 24,
      borderRadius: 18,
      rowGap: 16,
    },
    cardTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    cardBody: {
      ...typography.body,
      color: colors.textSecondary,
    },
    section: {
      rowGap: 12,
    },
    sectionLabel: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 4,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      ...typography.body,
      color: colors.textSecondary,
      paddingHorizontal: 12,
      fontSize: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      color: colors.textPrimary,
      fontSize: 16,
    },
    otpInfo: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: "center",
    },
    backButton: {
      padding: 12,
      alignItems: "center",
    },
    backButtonText: {
      ...typography.body,
      color: colors.primary,
    },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 8,
    },
    hintText: {
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
  });
