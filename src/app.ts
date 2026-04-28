import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { db, connectDb } from './db/client';
import { createRedisClients, subscribe, CHAT_CHANNEL } from './pubsub/redis.pubsub';
import { setupSocket } from './socket';

import { RoomRepository } from './repositories/room.repository';
import { MessageRepository } from './repositories/message.repository';
import { RoomService } from './services/room.service';
import { MessageService } from './services/message.service';
import { PresenceService } from './services/presence.service';

async function bootstrap(): Promise<void> {
  // ── Infrastructure ─────────────────────────────────────────────────────────
  await connectDb();
  const { pub, sub } = await createRedisClients();

  // ── Dependency wiring (manual DI) ──────────────────────────────────────────
  const roomRepo = new RoomRepository(db);
  const messageRepo = new MessageRepository(db);

  const roomService = new RoomService(roomRepo, db);
  const messageService = new MessageService(messageRepo, roomRepo);
  const presenceService = new PresenceService(pub);

  // ── HTTP + Socket.io ────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  setupSocket(io, pub, { roomService, messageService, presenceService });

  // ── Redis Pub/Sub fan-out — runs once per instance ─────────────────────────
  await subscribe(sub, CHAT_CHANNEL, (payload) => {
    const data = payload as Record<string, unknown>;
    const { event, roomId, userId, msg } = data;

    switch (event) {
      case 'message:new':
        io.to(roomId as string).emit('message:new', msg);
        break;
      case 'user:online':
        io.emit('user:online', { userId });
        break;
      case 'user:offline':
        io.emit('user:offline', { userId });
        break;
      case 'typing:started':
        io.to(roomId as string).emit('typing:started', { userId, roomId });
        break;
      case 'typing:stopped':
        io.to(roomId as string).emit('typing:stopped', { userId, roomId });
        break;
    }
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  httpServer.listen(config.port, () => {
    console.log(`[app] chat-poc listening on port ${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[app] startup failed:', err);
  process.exit(1);
});
