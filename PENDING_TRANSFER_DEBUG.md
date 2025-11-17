# Pending Transfer Issue - Debug Guide

## Problem
Pending transfers show as "pending" on HomeScreen, but when user tries to claim, they get an error saying the transfer has already been claimed.

## Root Cause
The `EscrowService` is running in **MOCK MODE** - it's not executing real blockchain transactions. When a user attempts to claim:

1. The claim process calls `escrowService.transferFromEscrow()`
2. Mock mode generates a fake transaction hash (prefixed with `0xMOCK`)
3. The database status is updated to "claimed"
4. But **no actual funds are transferred**
5. On next claim attempt, it shows "already claimed" because database status is "claimed"

## Quick Fix for Testing

### 1. Check Transfer Status
Use the debug API to see the actual status:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://metasend.vercel.app/api/debug-transfers?transferId=TRANSFER_ID"
```

Or check all transfers for an email:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://metasend.vercel.app/api/debug-transfers?email=user@example.com"
```

### 2. Reset Mock Transfers
To reset transfers that were claimed in mock mode back to "pending":

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "reset-mock-transfers", "email": "user@example.com"}' \
  https://metasend.vercel.app/api/debug-transfers
```

This will:
- Find all transfers with status="claimed" and mock transaction hashes
- Reset them to status="pending"
- Clear the claim metadata

### 3. Check Logs
Look for these log messages in the browser console or terminal:

```
[HomeScreen] Found X claimable transfers: [...]
[PendingTransferService] Attempting to claim transfer: pending_...
[PendingTransferService] Transfer status: pending
[EscrowService] transferFromEscrow called: {...}
⚠️ [EscrowService] Running in MOCK MODE - No real blockchain transfer occurring!
[EscrowService] Mock transfer completed: 0xMOCK...
```

## Permanent Fix: Implement Real Blockchain Transfers

To enable actual fund transfers, update `src/services/EscrowService.ts`:

### 1. Install Dependencies
```bash
npm install ethers@6 @solana/web3.js tronweb
```

### 2. Implement Real Transfer Logic

Replace the mock `transferFromEscrow` method with:

```typescript
async transferFromEscrow(
  escrowAddress: string,
  privateKeyEncrypted: string,
  recipientAddress: string,
  amount: string,
  tokenAddress: string,
  chain: ChainType
): Promise<string> {
  const privateKey = await this.decryptPrivateKey(privateKeyEncrypted);

  if (chain === "evm") {
    // Use ethers.js for EVM chains
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // USDC contract
    const usdcContract = new ethers.Contract(
      tokenAddress,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );
    
    // Convert amount (assuming 6 decimals for USDC)
    const amountInWei = ethers.parseUnits(amount, 6);
    
    // Send transaction
    const tx = await usdcContract.transfer(recipientAddress, amountInWei);
    await tx.wait(); // Wait for confirmation
    
    return tx.hash;
  }
  
  // TODO: Implement for Solana and Tron
  throw new Error(`Chain ${chain} not yet implemented`);
}
```

### 3. Set IS_MOCK_MODE to false
```typescript
private readonly IS_MOCK_MODE = false;
```

### 4. Configure RPC Endpoints
Add to `.env`:
```
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
ESCROW_MASTER_KEY=your-secure-master-key-here
```

## Testing Checklist

- [ ] Send pending transfer to unregistered email
- [ ] Check database shows status="pending"
- [ ] New user signs up with that email
- [ ] HomeScreen shows pending transfer card
- [ ] Click "Claim pending USDC"
- [ ] Check logs for mock mode warnings
- [ ] Verify claim succeeds or shows proper error
- [ ] Check database status after claim
- [ ] If mock mode: use debug API to reset
- [ ] If real mode: verify funds in recipient wallet

## Environment Variables

Required for production:
- `METASEND_API_KEY` - API authentication
- `MONGODB_URI` - MongoDB connection string
- `BASE_RPC_URL` - Blockchain RPC endpoint
- `ESCROW_MASTER_KEY` - Encryption key for escrow wallets

## API Endpoints

- `GET /api/pending-transfers?recipientEmail=user@example.com` - Get pending transfers
- `PATCH /api/pending-transfers` (action: claim) - Claim transfer
- `GET /api/debug-transfers?transferId=ID` - Debug transfer status
- `POST /api/debug-transfers` (action: reset-mock-transfers) - Reset mock transfers

## Contact
For questions about implementing real blockchain transfers, refer to:
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Coinbase Smart Wallet SDK](https://docs.cdp.coinbase.com/wallet-sdk/docs)
- Base Sepolia USDC address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
