// server.ts — Custom Next.js server that adds Socket.IO
// Run with: ts-node server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Make io available globally so API routes can emit events
declare global {
  // eslint-disable-next-line no-var
  var _io: SocketIOServer | undefined;
}

app.prepare().then(async () => {
  // Connect to MongoDB
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Seed data on first run
  const { seedAdmin, seedMenu, seedTiffin } = await import('./src/lib/seed');
  await seedAdmin();
  await seedMenu();
  await seedTiffin();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  // Store io globally so API routes can emit
  global._io = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_order_room', (orderId: string) => {
      socket.join(`order_${orderId}`);
    });

    socket.on('agent_online', (agentId: string) => {
      socket.join(`agent_${agentId}`);
    });

    socket.on('agent_location_update', (data: { agentId: string; orderId?: string; lat: number; lng: number }) => {
      if (data.orderId) {
        io.to(`order_${data.orderId}`).emit('live_location', { lat: data.lat, lng: data.lng });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Apna Rasoi running at http://localhost:${PORT}`);
  });
});
