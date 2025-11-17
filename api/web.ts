/**
 * Unified web handler for all shareable links
 * Handles claim, payment, tips, invoices, and gifts
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoDb from "../src/services/mongoDatabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || "";
  
  // Parse route
  if (path.startsWith("/claim/")) {
    const transferId = path.replace("/claim/", "").split("?")[0];
    return handleClaim(transferId, res);
  }
  
  if (path.startsWith("/pay/")) {
    const requestId = path.replace("/pay/", "").split("?")[0];
    return handlePayment(requestId, res);
  }
  
  if (path.startsWith("/tip/")) {
    const jarId = path.replace("/tip/", "").split("?")[0];
    return handleTip(jarId, res);
  }
  
  return res.status(404).send(getErrorPage("Page not found"));
}

async function handleClaim(transferId: string, res: VercelResponse) {
  if (!transferId) {
    return res.status(400).send(getErrorPage("Invalid claim link"));
  }

  try {
    const transfer = await mongoDb.getPendingTransferById(transferId);

    if (!transfer) {
      return res.status(404).send(getErrorPage("Transfer not found"));
    }

    if (transfer.status !== "pending") {
      return res.status(400).send(getErrorPage(`This transfer has already been ${transfer.status}`));
    }

    if (new Date(transfer.expiresAt) < new Date()) {
      return res.status(400).send(getErrorPage("This transfer has expired"));
    }

    const deepLink = `metasend://claim/${transferId}`;
    return res.status(200).send(getClaimPage(transfer, deepLink));
  } catch (error) {
    console.error("Claim error:", error);
    return res.status(500).send(getErrorPage("Internal server error"));
  }
}

async function handlePayment(requestId: string, res: VercelResponse) {
  if (!requestId) {
    return res.status(400).send(getErrorPage("Invalid payment request link"));
  }

  try {
    const request = await mongoDb.getPaymentRequestById(requestId);

    if (!request) {
      return res.status(404).send(getErrorPage("Payment request not found"));
    }

    if (request.status === "paid") {
      return res.status(200).send(getPaidPage());
    }

    if (request.status === "cancelled") {
      return res.status(400).send(getErrorPage("This payment request has been cancelled"));
    }

    const deepLink = `metasend://pay/${requestId}`;
    return res.status(200).send(getPaymentPage(request, deepLink));
  } catch (error) {
    console.error("Payment error:", error);
    return res.status(500).send(getErrorPage("Internal server error"));
  }
}

async function handleTip(jarId: string, res: VercelResponse) {
  if (!jarId) {
    return res.status(400).send(getErrorPage("Invalid tip jar link"));
  }

  try {
    const jar = await mongoDb.getTipJarById(jarId);

    if (!jar) {
      return res.status(404).send(getErrorPage("Tip jar not found"));
    }

    if (jar.status === "closed") {
      return res.status(400).send(getErrorPage("This tip jar is no longer accepting tips"));
    }

    const deepLink = `metasend://tip/${jarId}`;
    return res.status(200).send(getTipPage(jar, deepLink));
  } catch (error) {
    console.error("Tip error:", error);
    return res.status(500).send(getErrorPage("Internal server error"));
  }
}

function getClaimPage(transfer: any, deepLink: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Claim ${transfer.amount} ${transfer.token} - MetaSend</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 32px; color: #1a202c; margin-bottom: 10px; }
        .amount { font-size: 48px; font-weight: bold; color: #667eea; margin: 20px 0; }
        .sender { font-size: 18px; color: #4a5568; margin-bottom: 30px; }
        .message {
          background: #f7fafc;
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
          color: #2d3748;
          font-style: italic;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 40px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 18px;
          margin: 10px 0;
        }
        .info { margin-top: 30px; padding-top: 30px; border-top: 1px solid #e2e8f0; }
        .steps { text-align: left; color: #4a5568; line-height: 1.8; }
        .steps li { margin-bottom: 10px; }
        .expires { margin-top: 20px; color: #e53e3e; font-size: 14px; }
        .footer { margin-top: 30px; color: #718096; font-size: 14px; }
      </style>
      <script>
        window.onload = function() {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = '${deepLink}';
          }
        };
      </script>
    </head>
    <body>
      <div class="container">
        <div class="icon">💰</div>
        <h1>You've Got Money!</h1>
        <div class="amount">${transfer.amount} ${transfer.token}</div>
        <div class="sender">from ${transfer.senderName || transfer.senderEmail}</div>
        ${transfer.message ? `<div class="message">"${transfer.message}"</div>` : ''}
        <a href="${deepLink}" class="button">Open MetaSend App</a>
        <div class="info">
          <div style="font-weight: 600; margin-bottom: 15px;">How to claim:</div>
          <ol class="steps">
            <li>Download MetaSend if you don't have it</li>
            <li>Sign in with ${transfer.recipientEmail}</li>
            <li>Funds will be automatically claimed</li>
          </ol>
        </div>
        <div class="expires">⏰ Expires: ${new Date(transfer.expiresAt).toLocaleDateString()}</div>
        <div class="footer">Powered by <strong>MetaSend</strong></div>
      </div>
    </body>
    </html>
  `;
}

function getPaymentPage(request: any, deepLink: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pay ${request.amount} ${request.token} - MetaSend</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #3A80F7 0%, #8B5CF6 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 28px; color: #1a202c; margin-bottom: 10px; }
        .amount { font-size: 48px; font-weight: bold; color: #3A80F7; margin: 20px 0; }
        .from { font-size: 18px; color: #4a5568; margin-bottom: 20px; }
        .description {
          background: #f7fafc;
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
          color: #2d3748;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3A80F7 0%, #8B5CF6 100%);
          color: white;
          padding: 16px 40px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 18px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; color: #718096; font-size: 14px; }
      </style>
      <script>
        window.onload = function() {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) { window.location.href = '${deepLink}'; }
        };
      </script>
    </head>
    <body>
      <div class="container">
        <div class="icon">💳</div>
        <h1>Payment Request</h1>
        <div class="amount">${request.amount} ${request.token}</div>
        <div class="from">from ${request.creatorName || request.creatorEmail}</div>
        <div class="description"><strong>Description:</strong><br>${request.description}</div>
        <a href="${deepLink}" class="button">Pay with MetaSend</a>
        <div class="footer">Powered by <strong>MetaSend</strong></div>
      </div>
    </body>
    </html>
  `;
}

function getTipPage(jar: any, deepLink: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${jar.title} - MetaSend</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 28px; color: #1a202c; margin-bottom: 10px; }
        .creator { font-size: 18px; color: #4a5568; margin-bottom: 20px; }
        .description { background: #f7fafc; padding: 20px; border-radius: 12px; margin: 20px 0; color: #2d3748; }
        .stats {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
          padding: 20px;
          background: #f7fafc;
          border-radius: 12px;
        }
        .stat-value { font-size: 24px; font-weight: bold; color: #F59E0B; }
        .stat-label { font-size: 14px; color: #718096; margin-top: 5px; }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
          color: white;
          padding: 16px 40px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 18px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; color: #718096; font-size: 14px; }
      </style>
      <script>
        window.onload = function() {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) { window.location.href = '${deepLink}'; }
        };
      </script>
    </head>
    <body>
      <div class="container">
        <div class="icon">🎉</div>
        <h1>${jar.title}</h1>
        <div class="creator">by ${jar.creatorName || jar.creatorEmail}</div>
        ${jar.description ? `<div class="description">${jar.description}</div>` : ''}
        <div class="stats">
          <div><div class="stat-value">${jar.tipCount}</div><div class="stat-label">Tips</div></div>
          <div><div class="stat-value">${jar.totalTipsReceived.toFixed(2)}</div><div class="stat-label">USDC</div></div>
        </div>
        <a href="${deepLink}" class="button">Send a Tip 🎁</a>
        <div class="footer">Powered by <strong>MetaSend</strong></div>
      </div>
    </body>
    </html>
  `;
}

function getPaidPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Completed - MetaSend</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 28px; color: #1a202c; margin-bottom: 20px; }
        p { color: #4a5568; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h1>Payment Completed!</h1>
        <p>This payment request has already been paid.</p>
      </div>
    </body>
    </html>
  `;
}

function getErrorPage(message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error - MetaSend</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 28px; color: #1a202c; margin-bottom: 20px; }
        p { color: #4a5568; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Oops!</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}
