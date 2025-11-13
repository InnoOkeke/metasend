import "dotenv/config";

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // Coinbase Configuration
    coinbaseAppId: process.env.COINBASE_APP_ID || "",
    cdpProjectId: process.env.CDP_PROJECT_ID || "",
    coinbaseOAuthClientId: process.env.COINBASE_OAUTH_CLIENT_ID || "",
    coinbaseRedirectScheme: process.env.COINBASE_REDIRECT_SCHEME || "metasend",
    coinbaseApiKey: process.env.COINBASE_API_KEY || "",
    coinbaseApiSecret: process.env.COINBASE_API_SECRET || "",
    
    // Coinbase Paymaster
    coinbasePaymasterApiKey: process.env.COINBASE_PAYMASTER_API_KEY || "",
    
    // Email Service
    sendgridApiKey: process.env.SENDGRID_API_KEY || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
    awsSesRegion: process.env.AWS_SES_REGION || "",
    awsSesAccessKey: process.env.AWS_SES_ACCESS_KEY || "",
    awsSesSecretKey: process.env.AWS_SES_SECRET_KEY || "",
    
    // App Configuration
    appUrl: process.env.APP_URL || "https://app.metasend.io",
    supportEmail: process.env.SUPPORT_EMAIL || "support@metasend.io",
    
    // Escrow Configuration
    escrowMasterKey: process.env.ESCROW_MASTER_KEY || "",
    pendingTransferExpiryDays: parseInt(process.env.PENDING_TRANSFER_EXPIRY_DAYS || "7", 10),
    
    // Rate Limits
    emailLookupRateLimit: parseInt(process.env.EMAIL_LOOKUP_RATE_LIMIT || "100", 10),
    sendRateLimit: parseInt(process.env.SEND_RATE_LIMIT || "20", 10),
    inviteRateLimit: parseInt(process.env.INVITE_RATE_LIMIT || "10", 10),
    
    // Backend API
    mongodbUri: process.env.MONGODB_URI || "",
    metasendApiBaseUrl: process.env.METASEND_API_BASE_URL || "",
    metasendApiKey: process.env.METASEND_API_KEY || "",
    
    eas: {
      projectId: process.env.EAS_PROJECT_ID || "",
    },
  },
});
