import { IRoomService } from '../../services/room.service';
import { RoomResponseMapper } from '../../dto/response/room.response';
import { AppException } from '../../exceptions';
import { TypedServer, TypedSocket } from '../index';

export function registerRoomHandler(
  io: TypedServer,
  socket: TypedSocket,
  roomService: IRoomService
): void {
  const userId = socket.data.userId as string;

  socket.on('dm:start', async (req, ack) => {
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

  socket.on('room:create', async (req, ack) => {
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

  socket.on('room:join', async (req, ack) => {
    try {
      await roomService.assertMember(req.roomId, userId);
      socket.join(req.roomId);
      if (ack) ack({ ok: true });
    } catch (err) {
      const msg = err instanceof AppException ? err.message : 'not a member';
      if (ack) ack({ ok: false, error: msg });
    }
  });
}
