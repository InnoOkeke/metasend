# Escrow Service Integration Plan

## Current Status (2025-11-18)
- ✅ `SharedEscrow.sol` deployed + Hardhat toolchain ready.
- ✅ `EscrowService` now proxies Coinbase Smart Wallet user operations (create/claim/refund) via `SharedEscrowDriver`.
- ✅ `PendingTransferService` writes `escrowTransferId`/`escrowStatus` metadata and calls driver for claim/cancel/expiry.
- ✅ Migration utility `npm run migrate:pending-transfers` backfills legacy rows.
- 🔄 API/cron routes still need to lean entirely on the new service + reconciliation jobs (see tasks below).

## Touchpoints
- `src/services/EscrowService.ts`
- `src/services/PendingTransferService.ts`
- `api/pending-transfers.ts` and related API routes (claim, refund, status)
- Background jobs in `api/cron/`
- React Native UI flows (auto-claim + manual claim entry points)

## Service Layer Changes
1. **EscrowService API surface**
   - `createOnchainTransfer(params)` → calls contract `createTransfer`.
   - `claimOnchainTransfer(transferId, recipientAddress, proof)` → wraps contract `claimTransfer`.
   - `refundOnchainTransfer(transferId, refundAddress)`.
   - `getOnchainTransfer(transferId)` and `syncTransferFromChain(transferId)` for reconciliation.
   - `listenEscrowEvents(callbacks)` using Alchemy/Infura websockets.
   - Each method accepts a `network` argument (default Base mainnet) for easier staging/testing.
2. **PendingTransferService**
   - On send: after DB entry, call `EscrowService.createOnchainTransfer`.
   - On auto-claim: fetch pending transfer, request recipient wallet from Coinbase SDK, then call `claimOnchainTransfer`.
   - On expiry cron: `refundOnchainTransfer` and mark DB accordingly.
   - Store on-chain metadata (tx hash, block number, contract status) for debugging.
3. **API Routes**
   - `/api/pending-transfers/create`: orchestrates send flow, handles errors from contract call.
   - `/api/pending-transfers/claim`: expects user auth + wallet address, triggers claim call.
   - `/api/pending-transfers/refund`: admin or automated expiry endpoint.
   - Provide `GET /api/pending-transfers/:id/status` that merges DB + contract info.
4. **Background Tasks**
   - `process-expiry.ts`: read contract state, identify expired but not refunded transfers, call refund endpoint.
   - `send-reminders.ts`: optionally checks on-chain expiry timestamp for accuracy.

## Data Model Updates
Add to pending transfer records:
- `escrowTransferId: string`
- `escrowTxHash: string`
- `escrowStatus: 'pending' | 'claimed' | 'refunded' | 'expired'`
- `recipientWallet?: string`
- `lastChainSyncAt: number`
- `recipientHash: string`

## Error Handling & Retries
- Wrap every on-chain call in exponential backoff with circuit breaker.
- Persist `lastError` on transfer for observability.
- Retry queue (BullMQ / simple cron) for failed claims/refunds.

## Configuration
- `ESCROW_CONTRACT_ADDRESS`
- `ESCROW_NETWORK` (base-mainnet, base-sepolia)
- `ESCROW_SALT_VERSION`
- `COINBASE_BACKEND_WALLET_ID`
- `PAYMASTER_URL`
- `ALCHEMY_WS_URL`

## Timeline (suggested)
1. Implement EscrowService scaffolding with mocked provider (week 1).
2. Wire PendingTransferService + API to new service (week 2).
3. Integrate event listener + reconciliation jobs (week 3).
4. Run staging E2E tests, verify metrics, then enable in production behind feature flag (week 4).
