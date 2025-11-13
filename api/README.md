# MetaSend API Endpoints

This folder contains serverless API endpoints for MetaSend, deployed on Vercel.

## Endpoints

### POST /api/send-email
Sends transactional emails using Resend.

**Authentication:** Bearer token (METASEND_API_KEY)

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "html": "<html>Email body</html>",
  "from": "MetaSend <support@metasend.io>" // optional
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "abc123",
  "message": "Email sent successfully"
}
```

### POST /api/cron/process-expiry
Processes expired pending transfers (runs hourly via Vercel Cron).

**Authentication:** X-Cron-Secret header

### POST /api/cron/send-reminders
Sends reminder emails for pending transfers (runs every 6 hours via Vercel Cron).

**Authentication:** X-Cron-Secret header

## Environment Variables

Required in Vercel project settings:

- `RESEND_API_KEY` - Resend API key for sending emails
- `METASEND_API_KEY` - API key for authenticating requests from mobile app
- `CRON_SECRET` - Secret for authenticating cron job requests
- `SUPPORT_EMAIL` - From email address (must be verified in Resend)
- `MONGODB_URI` - MongoDB connection string
- `ESCROW_MASTER_KEY` - Master key for escrow wallet encryption

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```

The endpoints will be available at: `https://your-project.vercel.app/api/*`

## Security

- All endpoints require authentication
- Email sending endpoint uses Bearer token authentication
- Cron endpoints use X-Cron-Secret header
- API keys should never be committed to git
