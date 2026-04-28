import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { registerPresenceHandler } from './handlers/presence.handler';
import { registerRoomHandler } from './handlers/room.handler';
import { registerMessageHandler } from './handlers/message.handler';
import { IRoomService } from '../services/room.service';
import { IMessageService } from '../services/message.service';
import { IPresenceService } from '../services/presence.service';

interface Services {
  roomService: IRoomService;
  messageService: IMessageService;
  presenceService: IPresenceService;
}

export function setupSocket(io: Server, pub: RedisClientType, services: Services): void {
  // middleware: extract and validate userId from query param
  io.use((socket, next) => {
    const userId = socket.handshake.query.userId as string;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return next(new Error('userId is required'));
    }
    socket.data.userId = userId.trim();
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`[socket] connected: ${userId} (${socket.id})`);

    await services.roomService.ensureUser(userId);

    registerPresenceHandler(io, socket, services.presenceService, pub);
    registerRoomHandler(io, socket, services.roomService);
    registerMessageHandler(io, socket, services.messageService, pub);

    socket.on('error', (err) => {
      console.error(`[socket] error from ${userId}:`, err.message);
    });
  });
}
