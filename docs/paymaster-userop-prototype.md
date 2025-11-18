# Paymaster-Sponsored UserOperation Prototype

## Objective
Enable the backend to call the shared escrow contract without holding ETH by using Coinbase Smart Wallet + Paymaster sponsorship. The backend signs a UserOperation, the Paymaster covers gas, and the bundler submits it to Base.

## Components
1. **Coinbase Smart Wallet backend signer** (service wallet authorized for escrow management).
2. **Paymaster endpoint** (Coinbase or third-party) issuing sponsorship receipts.
3. **Bundler RPC** (e.g., Base public bundler or third-party like Pimlico).
4. **UserOperation builder** that encodes escrow contract calls.

## Flow
1. Build calldata (e.g., `createTransfer(params)` ABI-encoded).
2. Construct `UserOperation` with:
   - `sender`: backend smart wallet address.
   - `callData`: smart-wallet specific wrapper that delegates to escrow contract.
   - `callGasLimit`, `verificationGasLimit`, `preVerificationGas`: estimated via bundler `eth_estimateUserOperationGas`.
3. Request sponsorship from Paymaster by sending the partially filled `UserOperation`.
4. Paymaster returns `paymasterAndData` plus updated gas limits.
5. Sign the UserOperation with backend smart wallet keys.
6. Submit to bundler via `eth_sendUserOperation`.
7. Poll `eth_getUserOperationByHash` until receipt confirms.
8. Persist hash + resulting transaction hash for reconciliation.

## Sample Script (TypeScript)
```ts
import { ethers } from "ethers";
import { SmartWalletClient, BundlerClient, PaymasterClient } from "@coinbase/smart-wallet";
import escrowAbi from "../artifacts/SharedEscrow.json" assert { type: "json" };

const config = {
  bundlerRpcUrl: process.env.BASE_BUNDLER_URL!,
  paymasterUrl: process.env.CB_PAYMASTER_URL!,
  backendWalletId: process.env.CB_BACKEND_WALLET_ID!,
  escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS!,
};

export async function createTransferUserOp(params: CreateTransferParams) {
  const smartWallet = new SmartWalletClient({ walletId: config.backendWalletId });
  const bundler = new BundlerClient(config.bundlerRpcUrl);
  const paymaster = new PaymasterClient(config.paymasterUrl);

  const iface = new ethers.utils.Interface(escrowAbi.abi);
  const callData = iface.encodeFunctionData("createTransfer", [params]);

  const scwCallData = smartWallet.encodeCallData({
    target: config.escrowAddress,
    data: callData,
    value: 0,
  });

  let userOp = await smartWallet.buildUserOperation({ callData: scwCallData });
  const gasEstimates = await bundler.estimateUserOperationGas(userOp);
  userOp = { ...userOp, ...gasEstimates };

  const sponsored = await paymaster.sponsorUserOperation(userOp);
  userOp = { ...userOp, ...sponsored }; // includes paymasterAndData

  const signedOp = await smartWallet.signUserOperation(userOp);
  const hash = await bundler.sendUserOperation(signedOp);
  return { userOpHash: hash };
}
```

## Configuration Checklist
- Backend env vars: `BASE_BUNDLER_URL`, `CB_PAYMASTER_URL`, `CB_BACKEND_WALLET_ID`, `ESCROW_CONTRACT_ADDRESS`.
- Coinbase console: enable server-side smart wallet + register Paymaster usage.
- Monitoring: log `userOpHash`, `status`, and Paymaster quota consumption.

## Testing Steps
1. Run script against Base Sepolia with faucet USDC + Paymaster sandbox.
2. Validate `eth_getUserOperationReceipt` shows success.
3. Confirm escrow contract events emitted.
4. Simulate failures (Paymaster rejection, gas underestimation) and ensure retries/backoff.

## Next Actions
- Wrap script into `EscrowService` helper.
- Add CLI in `scripts/` for manual create/claim/refund operations.
- Wire metrics (Datadog) for sponsorship success rate and latency.
