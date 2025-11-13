import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const PAYMENT_REQUESTS_KEY = '@metasend:payment_requests';

export interface PaymentRequest {
  id: string;
  fromEmail: string;
  fromWallet: string;
  toEmail: string;
  amount: number;
  currency: string;
  description: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  createdAt: string;
  paidAt?: string;
  txHash?: string;
  paidBy?: string;
}

/**
 * Create a payment request
 */
export async function createPaymentRequest(
  fromEmail: string,
  fromWallet: string,
  toEmail: string,
  amount: number,
  currency: string,
  description: string,
  dueDate?: string
): Promise<PaymentRequest> {
  const request: PaymentRequest = {
    id: uuidv4(),
    fromEmail,
    fromWallet,
    toEmail,
    amount,
    currency,
    description,
    dueDate,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const requests = await getPaymentRequests();
  requests.push(request);
  await AsyncStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(requests));

  // TODO: Send email notification to recipient

  return request;
}

/**
 * Get payment requests for a user
 */
export async function getPaymentRequests(
  email?: string,
  status?: PaymentRequest['status']
): Promise<PaymentRequest[]> {
  const data = await AsyncStorage.getItem(PAYMENT_REQUESTS_KEY);
  let requests: PaymentRequest[] = data ? JSON.parse(data) : [];

  if (email) {
    requests = requests.filter(
      req => req.fromEmail === email || req.toEmail === email
    );
  }

  if (status) {
    requests = requests.filter(req => req.status === status);
  }

  return requests.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Mark payment request as paid
 */
export async function markPaymentRequestPaid(
  id: string,
  txHash: string,
  paidBy: string
): Promise<PaymentRequest | null> {
  const requests = await getPaymentRequests();
  const request = requests.find(req => req.id === id);
  
  if (!request) return null;

  request.status = 'paid';
  request.paidAt = new Date().toISOString();
  request.txHash = txHash;
  request.paidBy = paidBy;

  await AsyncStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(requests));

  return request;
}

/**
 * Cancel payment request
 */
export async function cancelPaymentRequest(id: string): Promise<void> {
  const requests = await getPaymentRequests();
  const request = requests.find(req => req.id === id);
  
  if (request && request.status === 'pending') {
    request.status = 'cancelled';
    await AsyncStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(requests));
  }
}

/**
 * Get payment request URL
 */
export function getPaymentRequestUrl(requestId: string): string {
  return `https://metasend.io/pay/${requestId}`;
}
