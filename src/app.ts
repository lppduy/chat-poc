import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { config } from './config';
import { db, connectDb } from './db/client';
import { createRedisClients, subscribe, CHAT_CHANNEL } from './pubsub/redis.pubsub';
import { PubSubEvent } from './pubsub/types';
import { setupSocket, TypedServer } from './socket';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './socket/types';
import { Server } from 'socket.io';

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
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  }) as TypedServer;

  setupSocket(io, pub, { roomService, messageService, presenceService });

  // ── Redis Pub/Sub fan-out — runs once per instance ─────────────────────────
  await subscribe(sub, CHAT_CHANNEL, (payload) => {
    const e = payload as PubSubEvent;

    switch (e.event) {
      case 'message:new':
        io.to(e.roomId).emit('message:new', e.msg);
        break;
      case 'user:online':
        io.emit('user:online', { userId: e.userId });
        break;
      case 'user:offline':
        io.emit('user:offline', { userId: e.userId });
        break;
      case 'typing:started':
        io.to(e.roomId).emit('typing:started', { userId: e.userId, roomId: e.roomId });
        break;
      case 'typing:stopped':
        io.to(e.roomId).emit('typing:stopped', { userId: e.userId, roomId: e.roomId });
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
