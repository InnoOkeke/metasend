import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper to convert Express to Vercel format
const adaptVercelHandler = (handler: (req: VercelRequest, res: VercelResponse) => Promise<any>) => {
  return async (req: express.Request, res: express.Response) => {
    const vercelReq = req as unknown as VercelRequest;
    const vercelRes = res as unknown as VercelResponse;
    await handler(vercelReq, vercelRes);
  };
};

// Import Vercel handlers
import pendingTransfersHandler from './api/pending-transfers';
import giftsHandler from './api/gifts';
import healthHandler from './api/health';
import invoicesHandler from './api/invoices';
import paymentRequestsHandler from './api/payment-requests';
import sendEmailHandler from './api/send-email';
import tipsHandler from './api/tips';
import transfersHandler from './api/transfers';
import usersHandler from './api/users';
import processExpiryHandler from './api/cron/process-expiry';
import sendRemindersHandler from './api/cron/send-reminders';

// Mount API routes (adapted from Vercel to Express)
// Mount express Routers directly
app.use('/api/pending-transfers', pendingTransfersHandler);
app.all('/api/gifts', adaptVercelHandler(giftsHandler));
app.all('/api/health', adaptVercelHandler(healthHandler));
app.use('/api/invoices', invoicesHandler);
app.use('/api/payment-requests', paymentRequestsHandler);
app.use('/api/send-email', sendEmailHandler);
app.use('/api/tips', tipsHandler);
app.use('/api/transfers', transfersHandler);
app.use('/api/users', usersHandler);
import webRouter from './api/web';
app.use('/api/web', webRouter);
app.all('/api/cron/process-expiry', adaptVercelHandler(processExpiryHandler));
app.all('/api/cron/send-reminders', adaptVercelHandler(sendRemindersHandler));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'MetaSend API',
    version: '1.0.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MetaSend API server running on port ${PORT}`);
});

export default app;
