// Test script to check if email API is working
const fetch = require('node-fetch');

const API_BASE_URL = 'https://metasend-krd4955ib-leprofcode.vercel.app';
const API_KEY = 'ms_live_8f3a9d2c1e4b5a6f7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

async function testEmail() {
  console.log('🧪 Testing email API...');
  console.log('API URL:', `${API_BASE_URL}/api/send-email`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        to: 'okekeinnocent99@gmail.com',
        subject: 'Test Email from MetaSend',
        html: '<h1>Test Email</h1><p>This is a test email from MetaSend API.</p>',
        from: 'MetaSend <onboarding@resend.dev>',
      }),
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Email failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmail();
