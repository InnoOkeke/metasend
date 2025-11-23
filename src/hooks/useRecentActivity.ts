import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTransfers, TransferRecord } from '../services/transfers';
import { getTips, Tip } from '../services/tipping';
import { getCryptoGifts, CryptoGift } from '../services/gifts';
import { getPaymentRequests, PaymentRequest } from '../services/paymentRequests';
import { getInvoices, Invoice } from '../services/invoices';
import { getUsdcTransactions, BlockchainTransaction } from '../services/blockchain';
import { useCoinbase } from '../providers/CoinbaseProvider';

export type ActivityType =
    | 'transfer-sent'
    | 'transfer-received'
    | 'tip-sent'
    | 'tip-received'
    | 'gift-sent'
    | 'gift-received'
    | 'payment-request-paid'
    | 'payment-request-received'
    | 'invoice-sent'
    | 'invoice-received'
    | 'blockchain-sent'
    | 'blockchain-received';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    title: string;
    subtitle?: string;
    amount: number;
    currency: string;
    timestamp: number;
    status: 'pending' | 'completed' | 'failed' | 'expired' | 'cancelled';
    txHash?: string;
    metadata?: {
        from?: string;
        to?: string;
        message?: string;
        [key: string]: any;
    };
}

export function useRecentActivity() {
    const { profile } = useCoinbase();
    const walletAddress = profile?.walletAddress;
    const email = profile?.email;

    // 1. Transfers (App-level)
    const { data: transfers = [] } = useQuery({
        queryKey: ['transfers', walletAddress],
        queryFn: () => walletAddress ? listTransfers(walletAddress) : [],
        enabled: !!walletAddress,
    });

    // 2. Tips
    const { data: tips = [] } = useQuery({
        queryKey: ['tips', walletAddress],
        queryFn: () => walletAddress ? getTips(walletAddress) : [],
        enabled: !!walletAddress,
    });

    // 3. Gifts
    const { data: gifts = [] } = useQuery({
        queryKey: ['gifts', walletAddress, email],
        queryFn: () => getCryptoGifts(walletAddress || email),
        enabled: !!(walletAddress || email),
    });

    // 4. Payment Requests
    const { data: paymentRequests = [] } = useQuery({
        queryKey: ['paymentRequests', email],
        queryFn: () => getPaymentRequests(email),
        enabled: !!email,
    });

    // 5. Invoices
    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices', email],
        queryFn: () => getInvoices(email),
        enabled: !!email,
    });

    // 6. Blockchain Transactions
    const { data: blockchainTxs = [] } = useQuery({
        queryKey: ['blockchainTransactions', walletAddress],
        queryFn: () => walletAddress ? getUsdcTransactions(walletAddress as `0x${string}`) : [],
        enabled: !!walletAddress,
    });

    const activities = useMemo(() => {
        const allActivities: ActivityItem[] = [];

        // Process Transfers
        transfers.forEach(t => {
            allActivities.push({
                id: t.id,
                type: 'transfer-sent', // Currently listTransfers only returns sent transfers
                title: 'Sent Transfer',
                subtitle: `To: ${t.intent.recipientEmail}`,
                amount: -t.intent.amountUsdc,
                currency: 'USDC',
                timestamp: new Date(t.createdAt).getTime(),
                status: t.status === 'sent' ? 'completed' : 'pending',
                txHash: t.txHash,
                metadata: {
                    to: t.intent.recipientEmail,
                    message: t.intent.memo,
                }
            });
        });

        // Process Tips
        tips.forEach(t => {
            const isSender = t.fromWallet === walletAddress;
            allActivities.push({
                id: t.id,
                type: isSender ? 'tip-sent' : 'tip-received',
                title: isSender ? 'Sent Tip' : 'Received Tip',
                subtitle: isSender ? (t.toEmail ? `To: ${t.toEmail}` : 'Sent via link') : `From: ${t.fromEmail}`,
                amount: isSender ? -t.amount : t.amount,
                currency: t.currency,
                timestamp: new Date(t.createdAt).getTime(),
                status: t.status === 'completed' ? 'completed' : 'pending',
                txHash: t.txHash,
                metadata: {
                    from: t.fromEmail,
                    to: t.toEmail,
                    message: t.message,
                }
            });
        });

        // Process Gifts
        gifts.forEach(g => {
            const isSender = g.fromWallet === walletAddress || g.fromEmail === email;
            // Only show if completed or if I'm the sender (pending sent gift)
            if (g.status === 'claimed' || isSender) {
                allActivities.push({
                    id: g.id,
                    type: isSender ? 'gift-sent' : 'gift-received',
                    title: isSender ? 'Sent Gift' : 'Received Gift',
                    subtitle: isSender ? (g.toEmail ? `To: ${g.toEmail}` : 'Created gift link') : `From: ${g.fromName || g.fromEmail}`,
                    amount: isSender ? -g.amount : g.amount,
                    currency: g.currency,
                    timestamp: new Date(g.createdAt).getTime(),
                    status: g.status === 'claimed' ? 'completed' : 'pending',
                    txHash: g.txHash,
                    metadata: {
                        from: g.fromName,
                        to: g.toName,
                        message: g.message,
                        theme: g.theme,
                    }
                });
            }
        });

        // Process Payment Requests
        paymentRequests.forEach(pr => {
            const isPayer = pr.paidBy === walletAddress;
            const isCreator = pr.fromEmail === email;

            // Show if I'm the creator (received/pending/expired) or if I paid it (paid)
            if (isCreator || (pr.status === 'paid' && isPayer)) {
                let type: ActivityType = 'payment-request-received'; // Default to received (request created)
                if (pr.status === 'paid' && isPayer) type = 'payment-request-paid';

                let status: 'pending' | 'completed' | 'failed' | 'expired' | 'cancelled' = 'pending';
                if (pr.status === 'paid') status = 'completed';
                if (pr.status === 'expired') status = 'expired';
                if (pr.status === 'cancelled') status = 'cancelled';

                allActivities.push({
                    id: pr.id,
                    type,
                    title: isCreator ? 'Payment Request' : 'Paid Request',
                    subtitle: isCreator ? `From: ${pr.toEmail}` : `To: ${pr.fromEmail}`,
                    amount: isCreator ? pr.amount : -pr.amount,
                    currency: pr.currency,
                    timestamp: new Date(pr.paidAt || pr.createdAt).getTime(),
                    status,
                    txHash: pr.txHash,
                    metadata: {
                        description: pr.description,
                        from: pr.fromEmail,
                        to: pr.toEmail,
                    }
                });
            }
        });

        // Process Invoices
        invoices.forEach(inv => {
            const isSender = inv.fromEmail === email;
            // Only show if paid or if I sent it
            if (inv.status === 'paid' || isSender) {
                allActivities.push({
                    id: inv.id,
                    type: isSender ? 'invoice-sent' : 'invoice-received',
                    title: `Invoice ${inv.invoiceNumber}`,
                    subtitle: isSender ? `To: ${inv.toName}` : `From: ${inv.fromName}`,
                    amount: isSender ? inv.total : -inv.total,
                    currency: inv.currency,
                    timestamp: new Date(inv.createdAt).getTime(),
                    status: inv.status === 'paid' ? 'completed' : 'pending',
                    txHash: inv.txHash,
                    metadata: {
                        from: inv.fromName || inv.fromEmail,
                        to: inv.toName || inv.toEmail,
                        invoiceNumber: inv.invoiceNumber,
                    }
                });
            }
        });

        // Process Blockchain Txs (Fallback for untracked items)
        // We need to deduplicate. If a txHash exists in other activities, skip it here.
        const knownHashes = new Set(allActivities.map(a => a.txHash).filter(Boolean));

        blockchainTxs.forEach(tx => {
            if (!knownHashes.has(tx.hash)) {
                const isSent = tx.type === 'sent';
                allActivities.push({
                    id: tx.hash,
                    type: isSent ? 'blockchain-sent' : 'blockchain-received',
                    title: isSent ? 'Sent USDC' : 'Received USDC',
                    subtitle: isSent ? `To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
                    amount: isSent ? -tx.value : tx.value,
                    currency: 'USDC',
                    timestamp: tx.timestamp,
                    status: 'completed',
                    txHash: tx.hash,
                    metadata: {
                        from: tx.from,
                        to: tx.to,
                    }
                });
            }
        });

        return allActivities.sort((a, b) => b.timestamp - a.timestamp);
    }, [transfers, tips, gifts, paymentRequests, invoices, blockchainTxs, walletAddress, email]);

    return { activities };
}
