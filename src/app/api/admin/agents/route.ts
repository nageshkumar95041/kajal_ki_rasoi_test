import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Agent, User } from '@/lib/models';
import { requireAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();
  const agents = await Agent.find({}).sort({ status: 1, name: 1 });
  return NextResponse.json({ success: true, agents });
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  await connectDB();

  const { name, contact, password } = await req.json();
  if (!name || !contact || !password) {
    return NextResponse.json({ success: false, message: 'name, contact, and password are required.' }, { status: 400 });
  }

  // Create user account for agent
  const existing = await User.findOne({ contact });
  let agentUserId: string;

  if (existing) {
    if (existing.role === 'agent') {
      return NextResponse.json({ success: false, message: 'Agent with this contact already exists.' }, { status: 409 });
    }
    existing.role = 'agent';
    existing.isVerified = true; // Agents are verified by admin — no OTP needed
    await existing.save();
    agentUserId = String(existing._id);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, contact, password: hashed, role: 'agent', isVerified: true });
    agentUserId = String(newUser._id);
  }

  // Create agent profile
  const agent = await Agent.create({
    userId: agentUserId,
    name,
    phone: contact,
    status: 'Offline',
    currentLoad: 0,
    maxBatchLimit: 5,
    location: { type: 'Point', coordinates: [0, 0] },
  });

  return NextResponse.json({ success: true, agent });
}
