import { Server, Socket } from 'socket.io';
import { IRoomService } from '../../services/room.service';
import { RoomResponseMapper } from '../../dto/response/room.response';
import { CreateRoomRequest, DmStartRequest } from '../../dto/request/create-room.request';
import { AppException } from '../../exceptions';

export function registerRoomHandler(
  io: Server,
  socket: Socket,
  roomService: IRoomService
): void {
  const userId = socket.data.userId as string;

  socket.on('dm:start', async (req: DmStartRequest, ack?: Function) => {
    try {
      const room = await roomService.getOrCreateDirectRoom(userId, req.targetUserId);

      socket.join(room.id);
      io.to(`user:${req.targetUserId}`).socketsJoin(room.id);

      const response = RoomResponseMapper.fromDomain(room);
      // emit via personal rooms — socketsJoin is async so room.id may not include bob yet
      socket.emit('room:created', response);
      io.to(`user:${req.targetUserId}`).emit('room:created', response);

      if (ack) ack({ ok: true, roomId: room.id });
    } catch (err) {
      console.error('[room] dm:start error', err);
      const msg = err instanceof AppException ? err.message : 'failed to create dm';
      if (ack) ack({ ok: false, error: msg });
    }
  });

  socket.on('room:create', async (req: CreateRoomRequest, ack?: Function) => {
    try {
      const allMembers = Array.from(new Set([userId, ...req.memberIds]));
      const room = await roomService.createGroupRoom(req.name, allMembers);

      for (const memberId of room.members) {
        io.to(`user:${memberId}`).socketsJoin(room.id);
      }

      const response = RoomResponseMapper.fromDomain(room);
      // emit via personal rooms — socketsJoin is async so members may not be in room.id yet
      for (const memberId of room.members) {
        io.to(`user:${memberId}`).emit('room:created', response);
      }

      if (ack) ack({ ok: true, roomId: room.id });
    } catch (err) {
      console.error('[room] room:create error', err);
      const msg = err instanceof AppException ? err.message : 'failed to create room';
      if (ack) ack({ ok: false, error: msg });
    }
  });

  socket.on('room:join', async ({ roomId }: { roomId: string }, ack?: Function) => {
    try {
      await roomService.assertMember(roomId, userId);
      socket.join(roomId);
      if (ack) ack({ ok: true });
    } catch (err) {
      const msg = err instanceof AppException ? err.message : 'not a member';
      if (ack) ack({ ok: false, error: msg });
    }
  });
}
