# Render Deployment Playbook

This guide covers everything needed to run the MetaSend backend on [Render](https://render.com), including environment variables, one-off migrations, and post-deploy validation.

## 1. Provision the Web Service

1. Install dependencies locally and make sure `npm run server:build` exits cleanly.
2. Deploy using the provided blueprint:

   ```bash
   render blueprint deploy render.yaml
   ```

   _or_ create a **Web Service** manually in the Render dashboard with:

   - **Runtime:** Node 18+
   - **Build Command:** `npm install && npm run server:build`
   - **Start Command:** `npm run server:start`
   - **Instance Type:** At least `Starter` (0.5 GB RAM) for Mongo + paymaster traffic.

## 2. Environment Variables

The `render.yaml` blueprint already enumerates every backend secret; set them via the dashboard or CLI before the first deploy.

| Group | Variables | Notes |
| --- | --- | --- |
| Core | `NODE_ENV`, `PORT`, `MONGODB_URI`, `METASEND_API_KEY`, `CRON_SECRET` | `PORT` must stay in sync with `server.ts` (default `10000`). |
| Escrow Driver | `ESCROW_CONTRACT_ADDRESS`, `ESCROW_TREASURY_WALLET`, `ESCROW_TOKEN_ADDRESS`, `ESCROW_NETWORK`, `ESCROW_RPC_URL`, `ESCROW_SALT_VERSION`, `ESCROW_EXPIRY_SECONDS`, `ESCROW_USE_MOCK=false` | Leave `ESCROW_RPC_URL` empty to use the default Base RPC. |
| Coinbase CDP | `CDP_BACKEND_ACCOUNT_NAME`, `CDP_BACKEND_SMART_ACCOUNT_NAME`, `PAYMASTER_URL`, `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_PAYMASTER_API_KEY` | `PAYMASTER_URL` overrides `PAYMASTER_API_URL` when using a custom sponsor endpoint. |
| Providers | `MOONPAY_API_KEY/SECRET`, `TRANSAK_API_KEY/SECRET`, `PAYCREST_API_KEY/SECRET`, etc. | Omit or use placeholder keys if a provider is disabled. |
| Email | `RESEND_API_KEY` (or SendGrid/SES equivalents) | Required for reminder/claim emails. |

> 🛡️ Never enable `ESCROW_USE_MOCK` in staging/production; the shared escrow driver must run against Coinbase CDP.

## 3. Pending Transfer Migration

Run the migration after the new backend is live so every legacy pending transfer receives an `escrowTransferId`.

### Pre-checks

- `ESCROW_CONTRACT_ADDRESS`, `ESCROW_TREASURY_WALLET`, and `PAYMASTER_URL` are populated.
- `ESCROW_USE_MOCK=false` so the driver hits Coinbase.
- Mongo connection string points to the production database.

### Commands

From a Render Shell session (or any machine with access to the production `.env`):

```bash
npm run migrate:pending-transfers -- --dry-run
npm run migrate:pending-transfers -- --limit=100
npm run migrate:pending-transfers
```

Flags:

- `--dry-run` – list candidates without touching the chain or database.
- `--limit=<n>` – cap the number of successful migrations in one run.
- `--transferId=<id>` – re-run escrow creation for a single problematic row.

The script logs each migrated record and clears legacy `escrowAddress` / `escrowPrivateKeyEncrypted` columns as it goes.

## 4. Background Tasks on Render

Render does not provide Vercel-style per-function crons, so schedule two Cron Jobs that `curl` the deployed API:

1. **Expiry Processor** – schedule `0 * * * *` (hourly):

   ```bash
   curl -s -X POST "$METASEND_API_BASE_URL/api/cron/process-expiry" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Reminder Emails** – schedule `0 */6 * * *` (every six hours):

   ```bash
   curl -s -X POST "$METASEND_API_BASE_URL/api/cron/send-reminders" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

Set `METASEND_API_BASE_URL` to the public Render URL (for example `https://metasend-api.onrender.com`). Each Cron Job can store its own environment variables inside the Render dashboard.

## 5. Deployment Steps

1. **CI Checks:**
   - `npm run server:build`
   - `npx hardhat test`
2. **Render Deploy:** `render deploy <service-name>` (or push to the connected Git repo and trigger auto-deploy).
3. **Monitor Logs:** confirm `SharedEscrowDriver` logs the `createTransfer` call on boot, indicating that the driver can talk to Coinbase CDP.

## 6. Post-Deploy Validation

1. **Health Check** – `curl https://<render-url>/api/health` should return `{ "ok": true }`.
2. **Create Pending Transfer** – Use the Expo app (pointed at the Render backend) to send USDC to a brand-new email. Verify Mongo now shows `escrowTransferId`, `recipientHash`, and `escrowStatus="pending"`.
3. **On-Chain Inspection** – Query the contract: `npx hardhat call --network base --contract SharedEscrow --function getTransfer --args <escrowTransferId>` and confirm the sender + amount match.
4. **Claim Flow** – Complete the claim via the app. Backend logs should show `claimTransfer` along with a `userOpHash`. Mongo should flip to `claimed`.
5. **Refund Flow** – Cancel a different pending transfer (or let expiry cron run). Ensure `refundTransfer` logs fire and `escrowStatus` becomes `refunded`/`expired`.
6. **Cron Verification** – Manually trigger each cron endpoint once with the `CRON_SECRET` header and check the Render Cron logs for success.

Document the results (escrow IDs, timestamps, userOp hashes) before promoting the release.

---

Render now serves as the canonical backend environment. Keep the Paymaster quota, Mongo performance, and cron history on your daily ops checklist.
