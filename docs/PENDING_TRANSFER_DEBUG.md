# Pending Transfer Debug Guide (Shared Escrow)

Pending transfers now rely on the pooled `SharedEscrow` contract. Use this checklist whenever a user reports that funds are stuck, already claimed, or missing.

## 1. Verify API + Database State

```bash
curl -H "Authorization: Bearer $METASEND_API_KEY" \
  "https://metasend.vercel.app/api/pending-transfers?transferId=pending_1731929922_abcd"
```

Key fields to inspect:

- `status` – `pending`, `claimed`, `cancelled`, `expired`.
- `escrowTransferId` – 32-byte hash returned by the contract. Missing value means the send never made it on-chain.
- `escrowStatus` – should mirror contract status (`pending`, `claimed`, `refunded`, `expired`).
- `escrowTxHash` – UserOp hash for the most recent action.
- `lastChainSyncAt` – timestamp of the most recent on-chain reconciliation.

If `escrowTransferId` is empty, re-run the migration utility for that transfer ID:

```bash
npm run migrate:pending-transfers -- --transferId=pending_1731929922_abcd
```

## 2. Inspect On-Chain State

```
npx hardhat console --network baseSepolia
> const escrow = await ethers.getContractAt("SharedEscrow", process.env.ESCROW_CONTRACT_ADDRESS)
> await escrow.getTransfer("0xTRANSFER_ID")
```

Compare the returned struct with Mongo:

| Field | Mongo | On-Chain | Notes |
| --- | --- | --- | --- |
| `amount` | Decimal string | `uint96` | Convert using `parseUnits(amount, decimals)` to compare. |
| `recipientHash` | Hex string | bytes32 | Must match salted hash of `recipientEmail`. |
| `expiry` | ISO string | Unix seconds | Use `new Date(expiry * 1000)` for human-readable. |
| `status` | `escrowStatus` | enum (0-3) | 0 pending, 1 claimed, 2 refunded, 3 expired. |

If the contract still shows `pending` but Mongo says `claimed`, a claim UserOp likely failed before being mined. Re-run the claim path by calling `pendingTransferService.claimPendingTransfer` (via API or server console).

## 3. Review Driver Logs

Backend logs include helpful breadcrumbs:

```
[SharedEscrowDriver] createTransfer transferId=pending_... userOpHash=0x...
[SharedEscrowDriver] claimTransfer transferId=0x... recipient=0xRecipient userOpHash=0x...
[SharedEscrowDriver] refundTransfer error=PaymasterQuotaExceeded
```

- `PaymasterQuotaExceeded` – Coinbase paymaster rejected the sponsorship. Retry later or top up the quota.
- `BatchValidationError` – Bundler rejected the call (often due to outdated nonce). Re-submit the UserOp.

Set `DEBUG=cdp:*` locally to see the raw payloads.

## 4. Common Scenarios

| Symptom | Diagnosis | Action |
| --- | --- | --- |
| Claim button says "already claimed" but wallet never received funds. | Mongo marked `status="claimed"` even though claim UserOp reverted. | Check logs for `SharedEscrowDriver` errors; if claim failed, manually set `status="pending"` and `escrowStatus="pending"`, then trigger claim again. |
| Transfer expired on-chain but UI still shows pending. | Cron job missed the refund or `escrowService.refundOnchainTransfer` failed. | Run `pendingTransferService.expirePendingTransfers()` manually or call `/api/cron/process-expiry`. |
| `escrowTransferId` missing. | Legacy transfer never migrated. | Run `npm run migrate:pending-transfers -- --transferId=<id>`. |
| UserOp hash present but BaseScan shows `Dropped`. | Bundler dropped the op before inclusion. | Re-issue the action; the contract state is unchanged. |

## 5. Forcing a Reclaim / Refund

You can re-trigger actions through the API without touching the mobile client:

```bash
# Claim
curl -X PATCH -H "Authorization: Bearer $METASEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"claim","transferId":"pending_...","claimantUserId":"user_123"}' \
  https://metasend.vercel.app/api/pending-transfers

# Cancel / Refund
curl -X PATCH -H "Authorization: Bearer $METASEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"cancel","transferId":"pending_...","senderUserId":"user_abc"}' \
  https://metasend.vercel.app/api/pending-transfers
```

## 6. Environment Flags

- Ensure `ESCROW_USE_MOCK=false` in any environment where you expect on-chain effects.
- `ESCROW_NETWORK` should match the deployed contract (Base or Base Sepolia).
- `PAYMASTER_URL` must point to the project-specific Coinbase paymaster endpoint.

## 7. Toolbelt

```bash
# List outstanding pending transfers missing on-chain IDs
mongosh "$MONGODB_URI" --quiet --eval 'db.pendingTransfers.find({ status: "pending", $or: [{ escrowTransferId: { $exists: false } }, { escrowTransferId: "" }] }).count()'

# Dry-run migration to preview fixes
npm run migrate:pending-transfers -- --dry-run

# Inspect a transfer from Node REPL
node -e "(async () => { const { pendingTransferService } = require('./dist/services/PendingTransferService'); console.log(await pendingTransferService.getTransferDetails('pending_...')); })();"
```

Keep this guide handy whenever on-chain state and UI diverge—the fix is usually driving the correct `escrowService` action or rerunning the migration utility.
