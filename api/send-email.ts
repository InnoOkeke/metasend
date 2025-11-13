import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify request is from your app (simple security check)
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.METASEND_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { to, subject, html, from } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const { data, error } = await resend.emails.send({
      from: from || process.env.SUPPORT_EMAIL || 'MetaSend <support@metasend.io>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to send email',
        details: error.message
      });
    }

    console.log('✅ Email sent:', { to, subject, id: data?.id });

    return res.status(200).json({ 
      success: true, 
      messageId: data?.id,
      message: 'Email sent successfully' 
    });
  } catch (error) {
    console.error('❌ Email send error:', error);
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
