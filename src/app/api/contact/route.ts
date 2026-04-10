import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { name, contact, message } = await req.json();
  if (!name || !contact || !message) return NextResponse.json({ success: false, message: 'All fields required.' }, { status: 400 });
  await sendMail('kajalkirasoi4@gmail.com', `New Contact from ${name}`,
    `<h3>Contact Request</h3><p><b>Name:</b> ${name}</p><p><b>Contact:</b> ${contact}</p><p><b>Message:</b> ${message}</p>`
  );
  return NextResponse.json({ success: true, message: 'Message sent.' });
}
