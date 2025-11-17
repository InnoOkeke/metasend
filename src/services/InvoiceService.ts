/**
 * Invoice Service
 * Handle creating and managing invoices
 */

import { z } from "zod";
import { Invoice, InvoiceItem, InvoiceStatus, ChainType } from "../types/database";

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().min(1),
  unitPrice: z.string(),
  amount: z.string(),
});

export const CreateInvoiceSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().optional(),
  clientAddress: z.string().optional(),
  items: z.array(InvoiceItemSchema).min(1),
  subtotal: z.string(),
  taxRate: z.string().optional(),
  tax: z.string().optional(),
  total: z.string(),
  token: z.string(),
  chain: z.enum(["evm", "solana", "tron"]),
  dueDate: z.string(), // ISO date
  notes: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export type InvoiceSummary = {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  clientName?: string;
  total: string;
  token: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
};

class InvoiceService {
  /**
   * Create a new invoice
   */
  async createInvoice(
    creatorUserId: string,
    creatorEmail: string,
    creatorName: string | undefined,
    creatorAddress: string | undefined,
    input: CreateInvoiceInput
  ): Promise<Invoice> {
    const validated = CreateInvoiceSchema.parse(input);
    
    const now = new Date();
    const invoiceNumber = this.generateInvoiceNumber();

    const invoice: Invoice = {
      invoiceId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber,
      creatorUserId,
      creatorEmail,
      creatorName,
      creatorAddress,
      clientEmail: validated.clientEmail,
      clientName: validated.clientName,
      clientAddress: validated.clientAddress,
      items: validated.items,
      subtotal: validated.subtotal,
      tax: validated.tax,
      taxRate: validated.taxRate,
      total: validated.total,
      token: validated.token,
      chain: validated.chain,
      status: "draft",
      issueDate: now.toISOString(),
      dueDate: validated.dueDate,
      notes: validated.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // TODO: Save to database
    console.log("📄 Invoice created:", invoice);

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    // TODO: Fetch from database
    return null;
  }

  /**
   * Get invoices created by user
   */
  async getMyInvoices(userId: string): Promise<InvoiceSummary[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Get invoices for client email
   */
  async getInvoicesForClient(email: string): Promise<InvoiceSummary[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Send invoice to client
   */
  async sendInvoice(invoiceId: string, userId: string): Promise<void> {
    // TODO: Verify user is creator
    // TODO: Update status to "sent"
    // TODO: Send email to client with payment link
    console.log("📧 Invoice sent:", invoiceId);
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(
    invoiceId: string,
    transactionHash: string
  ): Promise<void> {
    // TODO: Update database
    // TODO: Send payment confirmation emails
    console.log("✅ Invoice paid:", invoiceId);
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, userId: string): Promise<void> {
    // TODO: Verify user is creator
    // TODO: Update database
    // TODO: Send cancellation email
    console.log("❌ Invoice cancelled:", invoiceId);
  }

  /**
   * Check for overdue invoices
   */
  async checkOverdueInvoices(): Promise<void> {
    // TODO: Query database for unpaid invoices past due date
    // TODO: Update status to "overdue"
    // TODO: Send overdue reminders
    console.log("⏰ Checking for overdue invoices...");
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Generate shareable invoice link
   */
  generateInvoiceLink(invoiceId: string): string {
    return `https://metasend.vercel.app/invoice/${invoiceId}`;
  }

  /**
   * Calculate invoice totals
   */
  calculateInvoiceTotals(items: InvoiceItem[], taxRate?: string): {
    subtotal: string;
    tax: string;
    total: string;
  } {
    const subtotal = items.reduce((sum, item) => {
      return sum + parseFloat(item.amount);
    }, 0);

    const tax = taxRate ? subtotal * (parseFloat(taxRate) / 100) : 0;
    const total = subtotal + tax;

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    };
  }
}

export const invoiceService = new InvoiceService();
