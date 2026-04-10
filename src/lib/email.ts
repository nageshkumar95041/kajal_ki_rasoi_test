// import nodemailer from 'nodemailer';

// // Validates env vars are present at startup — surfaces missing config early
// if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
//   console.error('[email] WARNING: EMAIL_USER or EMAIL_PASS env var is missing. Emails will not be sent.');
// }

// // Port 587 + STARTTLS works on most hosting providers (Render, Railway, Vercel etc.)
// // Port 465 (SSL) is often blocked on free-tier hosts — 587 is more reliable in production
// export const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com',
//   port: 587,
//   secure: false, // false = STARTTLS on port 587
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS, // Must be a Gmail App Password (16 chars), NOT your regular password
//   },
// });

// export async function sendMail(to: string, subject: string, html: string) {
//   if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
//     throw new Error('Email env vars (EMAIL_USER / EMAIL_PASS) are not configured on this server.');
//   }
//   try {
//     const info = await transporter.sendMail({
//       from: `"Kajal Ki Rasoi" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html,
//     });
//     console.log(`[email] Sent to ${to} — messageId: ${info.messageId}`);
//     return info;
//   } catch (err) {
//     console.error(`[email] Failed to send to ${to}:`, err);
//     throw err; // Re-throw so callers can handle/report the failure
//   }
// }


// Uses Resend (https://resend.com) via HTTP instead of SMTP.
// Render.com blocks outbound SMTP ports (465/587) — HTTP on port 443 is never blocked.
// Free tier: 3,000 emails/month. Set RESEND_API_KEY in your Render environment variables.

if (!process.env.RESEND_API_KEY) {
  console.error('[email] WARNING: RESEND_API_KEY env var is missing. Emails will not be sent.');
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured on this server.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Kajal Ki Rasoi <orders@kajalkirasoi.com>', // Use your verified domain once set up e.g. noreply@kajalkirasoi.com
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`[email] Failed to send to ${to}:`, data);
    throw new Error(data?.message || 'Email send failed');
  }

  console.log(`[email] Sent to ${to} — id: ${data.id}`);
  return data;
}