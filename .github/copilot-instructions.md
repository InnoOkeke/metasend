# MetaSend Project - Copilot Instructions

This is a React Native mobile app built with Expo for sending USDC via email addresses.

## Project Overview

- **Framework:** Expo React Native with TypeScript
- **Authentication:** Coinbase Smart Wallet OAuth
- **Blockchain:** Base network (EVM) with multi-chain support (Solana, Tron ready)
- **Core Feature:** Email-based USDC transfers with pending transfer system for unregistered users
- **Payment Rail:** Gasless transfers via Coinbase Paymaster

## Architecture

### Service Layer
All business logic is in `src/services/`:
- `database.ts` - In-memory database (production-ready for swap)
- `UserDirectoryService.ts` - User lookup and registration
- `EscrowService.ts` - Temporary wallet management for pending transfers
- `PendingTransferService.ts` - Pending transfer lifecycle
- `UnifiedSendService.ts` - Send orchestration
- `EmailNotificationService.ts` - Email templates
- `ContactService.ts` - Recent recipients & favorites
- `BackgroundTaskService.ts` - Scheduled tasks

### Configuration
- Environment variables in `.env` (gitignored)
- Coinbase config in `src/config/coinbase.ts`
- App config in `app.config.js` (reads from `.env`)

### Key Features Implemented
1. **Email-Based Transfers:**
   - Direct send to registered users
   - Pending transfers with escrow for unregistered users
   - Auto-claim on signup
   - 7-day expiry with automatic refunds

2. **Email Notifications:**
   - Invite emails with claim links
   - Transfer notifications
   - Reminder emails (before expiry)
   - Claimed/expired notifications

3. **Contact Management:**
   - Recent recipients
   - Favorites
   - Search functionality

4. **Background Tasks:**
   - Expiry processing (hourly)
   - Reminder emails (6-hourly)

## Development Guidelines

### Environment Variables
Always use environment variables for:
- API keys and secrets
- Blockchain configuration
- Email service credentials
- App URLs and endpoints

Access via `Constants.expoConfig.extra` in services.

### Database
The in-memory database is production-ready:
- Complete TypeScript types in `src/types/database.ts`
- Abstract interface for easy swap to Firebase/Supabase/MongoDB
- No bundled demo users—signups flow through Coinbase to create accounts.

### Code Style
- TypeScript strict mode enabled
- Use service layer for all business logic
- Keep UI components clean and presentational
- Use React Query for data fetching (when applicable)

### Security
- Never commit `.env` file
- Use `ESCROW_MASTER_KEY` for encrypting escrow wallet private keys
- All sensitive operations in service layer

## Production Readiness

### TODO Before Launch
1. Replace mock blockchain calls in `EscrowService.ts` with real implementations
2. Integrate email service (SendGrid/Resend/AWS SES) in `EmailNotificationService.ts`
3. Swap in-memory database with production database
4. Deploy background tasks to serverless functions
5. Generate secure `ESCROW_MASTER_KEY`
6. Test full transfer flows end-to-end

### Testing Checklist
- [ ] Send to registered user (direct transfer)
- [ ] Send to unregistered user (pending transfer)
- [ ] Claim pending transfer on signup
- [ ] Pending transfer expiry and refund
- [ ] All email notifications working
- [ ] Contact management (recent, favorites)
- [ ] On/off-ramp integrations

## Completed Setup
- [x] Expo React Native TypeScript scaffold
- [x] Coinbase Smart Wallet OAuth integration
- [x] Email-based send system with pending transfers
- [x] Escrow wallet system
- [x] Email notification templates
- [x] Contact management
- [x] Background task scheduler
- [x] Environment variable configuration
- [x] Database layer with types
- [x] Service architecture

## Quick Start
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run start

# Launch platform
npm run ios     # iOS
npm run android # Android
npm run web     # Web
```

## Support
For questions about the codebase, refer to:
- `README.md` - Full project documentation
- `src/types/database.ts` - Database schema
- Service files for business logic implementation details

