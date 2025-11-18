# Shared Escrow Contract Specification

## Overview
A single escrow smart contract on Base holds USDC for all pending transfers. The backend operates a Coinbase Smart Wallet signer that creates, claims, and refunds transfers through sponsored UserOperations (Paymaster). Each transfer is identified by a deterministic ID derived from backend data, preventing duplication and enabling stateless reconciliation.

## Goals
- Custody pending payouts in one audited contract instead of per-user EOAs.
- Enable gasless interactions for both senders and recipients via Paymaster.
- Emit rich events so the backend can reconcile and trigger emails/notifications.
- Support automatic expiry refunds and manual claims without race conditions.

## Non-Goals
- Upgradeability. Deploy a v1 contract and replace with migration script if necessary.
- Direct email storage on-chain (use salted hashes only).

## Key Roles
- **BackendOperator (DEFAULT_ADMIN_ROLE + OPERATOR_ROLE):** Coinbase Smart Wallet controlling transfers and emergency operations.
- **PauseManager (PAUSER_ROLE):** Allowed to pause/unpause in emergencies.
- **Sender:** Address that funded the transfer (recorded for audits and refunds).
- **Recipient:** Wallet claiming the transfer after proving email ownership via backend.

## Storage Layout
```solidity
struct Transfer {
    address sender;           // wallet that initiated the transfer
    address token;            // USDC address (future-proof for multi-token)
    uint96 amount;            // enough for USDC balances
    bytes32 recipientHash;    // hash(salt + lowercaseEmail)
    uint40 expiry;            // unix timestamp
    Status status;            // Pending, Claimed, Refunded, Expired
}

mapping(bytes32 => Transfer) private transfers; // key = transferId
```
- `transferId = keccak256("MS_ESCROW_V1" || offchainTransferId || recipientHash || amount || expiry)`.
- `Status` is an enum with values `None, Pending, Claimed, Refunded, Expired`.
- Track total locked balance and per-sender stats for analytics.

## Events
```solidity
event TransferCreated(bytes32 indexed transferId, address indexed sender, bytes32 indexed recipientHash, address token, uint96 amount, uint40 expiry);
event TransferClaimed(bytes32 indexed transferId, address indexed recipient);
event TransferRefunded(bytes32 indexed transferId);
event TransferExpired(bytes32 indexed transferId);
event ContractPaused(address indexed by);
event ContractUnpaused(address indexed by);
```

## Public Read Functions
- `function getTransfer(bytes32 transferId) external view returns (Transfer memory)`
- `function transferStatus(bytes32 transferId) external view returns (Status)`
- `function lockedBalance(address token) external view returns (uint256)`

## Core Write Functions
### createTransfer
```solidity
function createTransfer(CreateParams calldata params) external onlyRole(OPERATOR_ROLE) whenNotPaused;
```
- Checks: `transfers[id].status == Status.None`, `params.expiry > block.timestamp`, `params.amount > 0`.
- Pulls funds using `IERC20Permit` if permit provided; otherwise requires pre-approved allowance.
- Stores Transfer with status `Pending` and emits `TransferCreated`.

### claimTransfer
```solidity
function claimTransfer(bytes32 transferId, address recipient, ClaimProof calldata proof) external onlyRole(OPERATOR_ROLE) whenNotPaused;
```
- Backend passes recipient wallet and proof (e.g., backend signature linking recipient to recipientHash).
- Contract verifies:
  - Transfer is `Pending` and not expired.
  - `proof.recipientHash == transfers[transferId].recipientHash` (validated off-chain before call).
- Marks status `Claimed` before external calls to prevent reentrancy.
- Sends USDC via `IERC20(token).transfer(recipient, amount)` and emits `TransferClaimed`.

### refundTransfer
```solidity
function refundTransfer(bytes32 transferId, address refundAddress) external onlyRole(OPERATOR_ROLE);
```
- Valid when status `Pending` and `block.timestamp >= expiry`.
- Updates status to `Refunded`, transfers funds back to `refundAddress` (usually original sender or treasury), emits `TransferRefunded`.

### expireTransfer
```solidity
function expireTransfer(bytes32 transferId) external onlyRole(OPERATOR_ROLE);
```
- Moves status from `Pending` to `Expired` without moving funds (used for bookkeeping before manual refunds).

### pause / unpause
Standard OpenZeppelin `Pausable` gated by `PAUSER_ROLE`.

## Security Considerations
- ReentrancyGuard applied to state-changing functions transferring tokens.
- Checks-effects-interactions pattern: status flipped before token transfer.
- Recipient hash prevents leakage of plaintext emails; rotate salt via contract constant identifier.
- Limit amount to `uint96` to bound storage + guard against overflow when summing.
- Emit events before external transfers for better tracing.
- Use OZ `AccessControl` for role assignments; admin multisig recommended.
- Contract holds USDC; treasury must watch `lockedBalance` vs actual token balance.

## Integration Notes
- Backend must persist `transferId`, `txHash`, and `status` to reconcile with chain.
- Cron job listens to events via WebSocket and retries status queries via RPC when missed.
- Emergency procedure: `pause()` + script to refund all pending transfers.

## Testing Matrix
- Unit: create → claim; create → expiry → refund; duplicate transfer ID rejection; pause gating.
- Fuzz: varying expiries, amount bounds, reentrancy attempts with malicious token mocks.
- Integration: Hardhat fork with real USDC + Paymaster-sponsored user operation from backend smart wallet.
