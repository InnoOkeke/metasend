# Shared Escrow Migration Guide

This playbook covers upgrading legacy pending transfers to the on-chain `SharedEscrow` contract when running the MetaSend backend on Render.

## Prerequisites

1. **Environment variables** – the Render service must define the following secrets:
   - `MONGODB_URI`
   - `ESCROW_CONTRACT_ADDRESS`
   - `ESCROW_TREASURY_WALLET`
   - `ESCROW_TOKEN_ADDRESS`
   - `ESCROW_NETWORK` (set to `base` in production)
   - `PAYMASTER_URL` (Coinbase CDP paymaster endpoint)
   - `ESCROW_USE_MOCK=false`
2. **Backend build** – deploy the latest `main` branch so the server contains the shared-escrow services and driver.
3. **Access** – enable a Render Shell or GitHub Actions runner with the same environment so the script can reach MongoDB.

## Dry-Run

```bash
npm run migrate:pending-transfers -- --dry-run --limit=10
```

- Uses the production MongoDB connection.
- Does **not** write on-chain or modify the database.
- Logs the transfers that would be migrated.

## Full Migration

1. Disable background jobs that might mutate pending transfers.
2. Run the migration with an optional resume pointer to avoid duplicates:

```bash
npm run migrate:pending-transfers -- --resumeFrom=<last-successful-transfer-id>
```

3. Monitor the console for `✅ Migrated` logs and capture user operation hashes for auditing.
4. Re-enable background jobs after the script finishes.

## Recovery / Reruns

- Use `--transferId=<id>` to replay a single failed record.
- Combine `--dry-run` and `--transferId` to inspect the payload before writing on-chain.
- The script automatically strips the deprecated escrow wallet fields once a transfer is migrated.

## Verification Checklist

- `pendingTransfers` documents now contain `escrowTransferId`, `recipientHash`, `escrowStatus`, and `lastChainSyncAt`.
- The Render logs show the corresponding Coinbase user operation hashes.
- `npm run server:build` remains clean after the migration.

Document the start/end timestamps and keep the console transcript in the ops runbook for traceability.
