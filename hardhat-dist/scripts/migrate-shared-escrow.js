"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongodb_1 = require("mongodb");
const EscrowService_1 = require("../src/services/EscrowService");
const parseArgs = () => {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const limitArg = args.find((arg) => arg.startsWith("--limit="));
    const transferArg = args.find((arg) => arg.startsWith("--transferId="));
    const resumeArg = args.find((arg) => arg.startsWith("--resumeFrom="));
    const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
    const transferId = transferArg ? transferArg.split("=")[1] : undefined;
    const resumeFrom = resumeArg ? resumeArg.split("=")[1] : undefined;
    return { dryRun, limit: Number.isFinite(limit ?? NaN) ? limit : undefined, transferId, resumeFrom };
};
const buildFilter = (transferId) => {
    if (transferId) {
        return { transferId };
    }
    return {
        status: "pending",
        $or: [
            { escrowTransferId: { $exists: false } },
            { escrowTransferId: "" },
            { escrowTransferId: null },
        ],
    };
};
const ensureEnv = () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required for pending transfer migration");
    }
    if (!process.env.ESCROW_CONTRACT_ADDRESS) {
        throw new Error("ESCROW_CONTRACT_ADDRESS must be set before migration");
    }
};
const toExpirySeconds = (iso) => {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) {
        throw new Error(`Invalid expiresAt value: ${iso}`);
    }
    return Math.floor(ms / 1000);
};
const migrateTransfer = async (transfer, dryRun) => {
    if (transfer.chain !== "evm") {
        console.warn(`Skipping transfer ${transfer.transferId} on unsupported chain ${transfer.chain}`);
        return null;
    }
    if (!transfer.tokenAddress) {
        throw new Error(`Transfer ${transfer.transferId} missing tokenAddress`);
    }
    const expirySeconds = toExpirySeconds(transfer.expiresAt);
    if (dryRun) {
        console.log(`DRY RUN - would migrate ${transfer.transferId} for ${transfer.recipientEmail}`);
        return null;
    }
    const receipt = await EscrowService_1.escrowService.createOnchainTransfer({
        recipientEmail: transfer.recipientEmail,
        amount: transfer.amount,
        decimals: transfer.decimals,
        tokenAddress: transfer.tokenAddress,
        chain: transfer.chain,
        expiry: expirySeconds,
    });
    return {
        escrowTransferId: receipt.transferId,
        escrowTxHash: receipt.txHash,
        escrowStatus: "pending",
        recipientHash: receipt.recipientHash,
        transactionHash: receipt.txHash,
        lastChainSyncAt: new Date().toISOString(),
    };
};
async function main() {
    ensureEnv();
    if (EscrowService_1.escrowService.isMockMode()) {
        throw new Error("EscrowService is in mock mode. Set ESCROW_USE_MOCK=false before migrating.");
    }
    const { dryRun, limit, transferId, resumeFrom } = parseArgs();
    const filter = buildFilter(transferId);
    const client = new mongodb_1.MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const collection = client.db("metasend").collection("pendingTransfers");
    const cursor = collection.find(filter).sort({ createdAt: 1 });
    let processed = 0;
    let migrated = 0;
    let resumeReached = !resumeFrom;
    while (await cursor.hasNext()) {
        const transfer = await cursor.next();
        if (!transfer) {
            break;
        }
        if (!resumeReached) {
            if (transfer.transferId === resumeFrom) {
                resumeReached = true;
            }
            else {
                continue;
            }
        }
        processed += 1;
        if (limit && migrated >= limit) {
            console.log("Reached migration limit, stopping.");
            break;
        }
        try {
            const update = await migrateTransfer(transfer, dryRun);
            if (!update) {
                continue;
            }
            await collection.updateOne({ transferId: transfer.transferId }, {
                $set: update,
                $unset: {
                    escrowAddress: "",
                    escrowPrivateKeyEncrypted: "",
                },
            });
            migrated += 1;
            console.log(`✅ Migrated ${transfer.transferId} -> ${update.escrowTransferId} (tx: ${update.escrowTxHash ?? "n/a"})`);
        }
        catch (error) {
            console.error(`❌ Failed to migrate ${transfer.transferId}:`, error);
        }
    }
    await client.close();
    console.log(`Processed ${processed} transfers, migrated ${migrated}.${dryRun ? " (dry run)" : ""}`);
}
main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
