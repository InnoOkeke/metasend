# Shared Escrow Contract - Live Runbook 🚀

MetaSend now routes every pending transfer through the pooled `SharedEscrow.sol` contract using Coinbase Smart Wallet user operations. This document tracks the live configuration, expected behaviors, and debug steps.

## System Overview

1. **Create Pending Transfer**
   - `PendingTransferService.createPendingTransfer` stores the record **and** calls `escrowService.createOnchainTransfer`.
   - Coinbase CDP backend wallet submits a gasless `createTransfer` UserOp via the Paymaster.
   - Mongo rows gain `escrowTransferId`, `recipientHash`, `escrowTxHash`, and `escrowStatus="pending"`.

2. **Claim Flow**
   - When the recipient taps *Claim*, the backend calls `escrowService.claimOnchainTransfer(escrowTransferId, wallet, email)`.
   - Contract validates the salted email hash and releases pooled USDC to the recipient wallet.
   - Mongo status moves to `claimed`, storing the claim UserOp hash and recipient wallet.

3. **Refund / Expiry**
   - Sender cancellations and cron-based expiries share the same path: `escrowService.refundOnchainTransfer`.
   - The contract returns funds to the original funding wallet, while Mongo marks `escrowStatus` as `refunded` or `expired`.

The mobile client never touches on-chain keys—everything runs through the backend smart wallet + paymaster.

## Environment Checklist

| Variable | Purpose |
| --- | --- |
| `ESCROW_CONTRACT_ADDRESS` | Deployed `SharedEscrow.sol` contract. |
| `ESCROW_TREASURY_WALLET` | Coinbase smart account that backs transfers. |
| `ESCROW_NETWORK` | `base` or `base-sepolia`. |
| `ESCROW_TOKEN_ADDRESS` | ERC-20 being pooled (USDC by default). |
| `PAYMASTER_URL` | Coinbase paymaster endpoint, or leave empty to use `PAYMASTER_API_URL`. |
| `ESCROW_RPC_URL` | Optional HTTP RPC for read calls (defaults to chain RPC). |
| `ESCROW_SALT_VERSION` | Domain separator for deterministic hashes (`MS_ESCROW_V1`). |
| `ESCROW_USE_MOCK` | Set to `true` locally to skip on-chain calls. **Must be `false` in staging/prod**. |

Set `MONGODB_URI`, `METASEND_API_KEY`, and `RESEND_API_KEY` as usual.

## Verifying the Flow

### 1. Create Transfer

```
npx hardhat console --network baseSepolia
> const escrow = await ethers.getContractAt("SharedEscrow", process.env.ESCROW_CONTRACT_ADDRESS)
> await escrow.getTransfer(TRANSFER_ID)
```

Expected output: sender set to treasury wallet, status `0`, amount in atomic units, expiry timestamp.

### 2. Claim Transfer

Logs in the backend (Vercel/Render):

```
[SharedEscrowDriver] createTransfer pending_... recipientHash=0xabc...
[SharedEscrowDriver] Claim userOp userOpHash=0x...
```

BaseScan link: `https://sepolia.basescan.org/tx/USER_OP_HASH` (UserOp bundler hash) and `.../address/{contract}` for events.

### 3. Refund / Expire

```
[SharedEscrowDriver] refundTransfer transferId=0x... refundAddress=0xSender
[PendingTransferService] Updating transfer status to expired
```

Mongo document will contain:

```json
{
  "transferId": "pending_...",
  "escrowTransferId": "0x8f...",
  "escrowStatus": "expired",
  "escrowTxHash": "0xUserOpHash",
  "lastChainSyncAt": "2025-11-18T12:00:00.000Z"
}
```

## Migration Steps

Legacy transfers that still relied on per-transfer wallets must be pushed on-chain once:

```bash
npm run migrate:pending-transfers -- --dry-run
npm run migrate:pending-transfers -- --limit=50
```

The script skips non-EVM chains and clears `escrowAddress` / `escrowPrivateKeyEncrypted` fields.

## Monitoring & Debugging

1. **Database** – `escrowStatus` should mirror the contract state. Use `lastChainSyncAt` to detect stale rows.
2. **On-chain** – `npx hardhat call --contract SharedEscrow --function getTransfer --args <ID>` or the snippet above.
3. **Driver Logs** – Each UserOp logs the call, payload, and resulting hash. Failures bubble up as thrown errors.
4. **Paymaster** – Non-200 responses from `PAYMASTER_URL` abort the flow; inspect the response body for quota or auth issues.

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `Escrow driver unavailable` | Running inside Expo/Web where backend driver cannot load. | Ensure send/claim routes go through `/api/pending-transfers`. |
| `Transfer is not yet registered on shared escrow` | Migration skipped row or create UserOp failed. | Re-run migration for that transfer or delete + re-create. |
| `UserOp dropped/replaced` | Bundler rejected the request (quota, nonce). | Check Coinbase CDP dashboard logs, retry with exponential backoff. |
| Transfer stuck `pending` on-chain after expiry | Refund cron not calling driver, or Paymaster rejecting refund. | Run `npm run migrate:pending-transfers -- --transferId=<id>` to reissue, then investigate cron logs. |

## Useful Commands

```bash
# Type-check backend + driver
npx tsc --noEmit

# Run Hardhat tests against SharedEscrow.sol
npx hardhat test

# Dry-run migration to see outstanding rows
npm run migrate:pending-transfers -- --dry-run
```

## Deployment Notes

- Keep `ESCROW_USE_MOCK=false` everywhere except local simulators.
- Point staging at Base Sepolia; production should flip to Base mainnet by updating `ESCROW_NETWORK` + addresses.
- After each deploy, run a smoke test: create pending transfer → claim → cancel another to exercise all three driver methods.

Shared escrow is live—monitor the paymaster dashboard and BaseScan events to ensure continuous gasless transfers.
