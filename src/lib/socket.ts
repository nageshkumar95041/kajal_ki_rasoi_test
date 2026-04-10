import type { Server as SocketIOServer } from 'socket.io';

// The Socket.IO server is initialized in server.ts and stored globally
export function getIO(): SocketIOServer | null {
  return global._io ?? null;
}

export function emitOrderUpdate(data: Record<string, unknown>) {
  const io = getIO();
  if (io) io.emit('orderUpdate', data);
}

declare global {
  // eslint-disable-next-line no-var
  var _io: SocketIOServer | undefined;
}
