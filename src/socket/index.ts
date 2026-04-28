import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { registerPresenceHandler } from './handlers/presence.handler';
import { registerRoomHandler } from './handlers/room.handler';
import { registerMessageHandler } from './handlers/message.handler';
import { IRoomService } from '../services/room.service';
import { IMessageService } from '../services/message.service';
import { IPresenceService } from '../services/presence.service';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface Services {
  roomService: IRoomService;
  messageService: IMessageService;
  presenceService: IPresenceService;
}

export function setupSocket(io: TypedServer, pub: RedisClientType, services: Services): void {
  // middleware: extract and validate userId from query param
  io.use((socket, next) => {
    const userId = socket.handshake.query.userId as string;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return next(new Error('userId is required'));
    }
    socket.data.userId = userId.trim();
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`[socket] connected: ${userId} (${socket.id})`);

    // join personal room and register handlers synchronously
    // so event listeners are ready before the client can emit anything
    socket.join(`user:${userId}`);

    registerPresenceHandler(io, socket as TypedSocket, services.presenceService, pub);
    registerRoomHandler(io, socket as TypedSocket, services.roomService);
    registerMessageHandler(io, socket as TypedSocket, services.messageService, pub);

    socket.on('error', (err) => {
      console.error(`[socket] error from ${userId}:`, err.message);
    });

    // ensureUser runs in background — not blocking handler registration
    services.roomService.ensureUser(userId).catch((err) =>
      console.error(`[socket] ensureUser failed for ${userId}:`, err)
    );
  });
}
