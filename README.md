# MetaSend Mobile

MetaSend is an Expo React Native application that lets users send USDC to any email address using a Coinbase embedded smart wallet on Base. Transfers are gasless thanks to Coinbase Paymaster integration, and recipients without an account receive an email invitation to claim their funds after onboarding.

## Features

- **Coinbase Smart Wallet Authentication:** Secure OAuth flow with session caching
- **Email-Based Transfers:** Send USDC to any email address, even non-registered users
- **Pending Transfer System:** 
  - Escrow wallets for unregistered recipients
  - Auto-claim on signup
  - 7-day expiry with automatic refunds
  - Email notifications at every stage
- **Gasless Transactions:** Coinbase Paymaster integration for sponsored transfers
- **Multi-Chain Support:** Ready for EVM, Solana, and Tron networks
- **Contact Management:** Recent recipients, favorites, and search
- **On/Off-Ramp Integration:** Quick links for Google Pay, Apple Pay, MoonPay, Paybis
- **Background Tasks:** Automated expiry checks and reminder emails

## Architecture

### Core Services

- **UserDirectoryService:** User lookup, registration, wallet resolution
- **EscrowService:** Temporary wallet generation for pending transfers
- **PendingTransferService:** Create, claim, cancel, and expire pending transfers
- **UnifiedSendService:** Orchestration layer for all send operations
- **EmailNotificationService:** Transactional email templates (invite, reminder, expiry, claim)
- **ContactService:** Recent recipients and favorites management
- **BackgroundTaskService:** Cron-style scheduler for expiry processing

### Database Layer

The app includes a complete in-memory database implementation with TypeScript types. Production-ready to swap with:
- Firebase Firestore
- Supabase
- MongoDB
- PostgreSQL

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Coinbase credentials and email service API keys. See [Environment Configuration](#environment-configuration) below.

3. Start the Expo development server:

   ```bash
   npm run start
   ```

4. Launch the platform target of your choice:

   - `npm run ios`
   - `npm run android`
   - `npm run web`

## Environment Configuration

Copy `.env.example` to `.env` and configure your secrets:

```bash
cp .env.example .env
```

### Required Environment Variables

| Variable | Description |
| --- | --- |
| `COINBASE_APP_ID` | Coinbase Embedded Wallet app identifier (currently: `162ddeb1-c67e-43fa-b38b-78a916eb7cde`) |
| `COINBASE_OAUTH_CLIENT_ID` | OAuth client ID from Coinbase developer console |
| `COINBASE_REDIRECT_SCHEME` | Deep link scheme (default: `metasend`) |
| `COINBASE_API_KEY` | Coinbase API key for wallet operations |
| `COINBASE_API_SECRET` | Coinbase API secret |
| `COINBASE_PAYMASTER_API_KEY` | API key for Coinbase paymaster sponsorship |

### Email Service Configuration

Choose one email provider and set its API key:

| Variable | Description |
| --- | --- |
| `SENDGRID_API_KEY` | SendGrid API key for transactional emails |
| `RESEND_API_KEY` | Resend API key (alternative to SendGrid) |
| `AWS_SES_REGION` | AWS SES region (alternative email service) |
| `AWS_SES_ACCESS_KEY` | AWS SES access key |
| `AWS_SES_SECRET_KEY` | AWS SES secret key |

### App Configuration

| Variable | Description |
| --- | --- |
| `APP_URL` | Production app URL (default: `https://app.metasend.io`) |
| `SUPPORT_EMAIL` | Support email address (default: `support@metasend.io`) |

### Escrow & Security

| Variable | Description |
| --- | --- |
| `ESCROW_MASTER_KEY` | Master encryption key for escrow wallet private keys (generate a secure random string) |
| `PENDING_TRANSFER_EXPIRY_DAYS` | Days before pending transfers expire (default: 7) |

### Rate Limits

| Variable | Description |
| --- | --- |
| `EMAIL_LOOKUP_RATE_LIMIT` | Max email lookups per minute (default: 100) |
| `SEND_RATE_LIMIT` | Max sends per minute (default: 20) |
| `INVITE_RATE_LIMIT` | Max invites per minute (default: 10) |

### Backend API (Optional)

| Variable | Description |
| --- | --- |
| `METASEND_API_BASE_URL` | Backend API base URL |
| `METASEND_API_KEY` | Backend API authentication key |

### Coinbase OAuth Setup

1. Register your app at [Coinbase Developer Console](https://portal.cdp.coinbase.com/)
2. Set OAuth redirect URI to: `metasend://auth` (or your custom scheme)
3. Ensure `app.json` uses the same scheme value
4. Add your OAuth client ID to `.env`

**Note:** The `.env` file is gitignored to protect your secrets. Never commit credentials to version control.

## Project Structure

```
src/
  components/          # Shared UI components
  config/              # Configuration (Coinbase, chains, etc.)
  navigation/          # React Navigation stacks
  providers/           # Context providers (Coinbase, Paymaster, Theme)
  screens/             # Feature screens
  services/            # Business logic layer
    - database.ts              # In-memory database (production-ready for swap)
    - UserDirectoryService.ts  # User lookup and registration
    - EscrowService.ts         # Temporary wallet management
    - PendingTransferService.ts # Pending transfer lifecycle
    - UnifiedSendService.ts    # Send orchestration
    - EmailNotificationService.ts # Email templates
    - ContactService.ts        # Recent recipients & favorites
    - BackgroundTaskService.ts # Scheduled tasks
    - addressResolution.ts     # Multi-chain address resolution
  types/               # TypeScript type definitions
    - database.ts              # Database schema types
  utils/               # Formatting helpers & theming
```

## Next Steps

### Production Deployment

1. **Blockchain Integration:**
   - Replace mock blockchain calls in `EscrowService.ts` with real implementations
   - Use ethers.js or viem for EVM chains
   - Use @solana/web3.js for Solana
   - Use TronWeb for Tron

2. **Email Service Integration:**
   - Choose SendGrid, Resend, or AWS SES
   - Add API key to `.env`
   - Update `EmailNotificationService.ts` to use the provider (examples provided in code)

3. **Database Setup:**
   - Replace `InMemoryDatabase` with production database
   - All services use the database abstraction layer
   - Types are defined in `src/types/database.ts`

4. **Security:**
   - Generate a strong `ESCROW_MASTER_KEY` for production
   - Consider using AWS KMS or Google Cloud KMS for key management
   - Enable rate limiting on API endpoints

5. **Background Tasks:**
   - Deploy `BackgroundTaskService` to a serverless function (AWS Lambda, Vercel Functions)
   - Set up cron jobs for:
     - Expiry processing (hourly)
     - Reminder emails (every 6 hours)

6. **Testing:**
   - Test full send flow: registered → registered
   - Test pending flow: registered → unregistered → claim
   - Test expiry flow: pending → expired → refund
   - Test email notifications at each stage

### Development Workflow

- **Live Data Only:** Demo seeds have been removed—use Coinbase signup plus `npm run backfill` (with your own JSON payloads) if you need fixtures.
- **Environment Variables:** All credentials are in `.env` (gitignored)
- **TypeScript Strict Mode:** Full type safety throughout the codebase
- **Service Layer:** Clean separation between UI and business logic

## License

This project is released under the MIT license.
