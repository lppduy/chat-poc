import { RedisClientType } from 'redis';
import { IPresenceService } from '../../services/presence.service';
import { publish, CHAT_CHANNEL } from '../../pubsub/redis.pubsub';
import { TypedServer, TypedSocket } from '../index';

export function registerPresenceHandler(
  io: TypedServer,
  socket: TypedSocket,
  presenceService: IPresenceService,
  pub: RedisClientType
): void {
  const userId = socket.data.userId as string;

  presenceService.setOnline(userId, socket.id).then(() => {
    publish(pub, CHAT_CHANNEL, { event: 'user:online', userId });
    console.log(`[presence] ${userId} online`);
  });

  socket.on('disconnect', async () => {
    await presenceService.setOffline(userId);
    await publish(pub, CHAT_CHANNEL, { event: 'user:offline', userId });
    console.log(`[presence] ${userId} offline`);
  });

  socket.on('typing:start', async ({ roomId }: { roomId: string }) => {
    await presenceService.setTyping(roomId, userId);
    await publish(pub, CHAT_CHANNEL, { event: 'typing:started', roomId, userId });
  });

  socket.on('typing:stop', async ({ roomId }: { roomId: string }) => {
    await presenceService.clearTyping(roomId, userId);
    await publish(pub, CHAT_CHANNEL, { event: 'typing:stopped', roomId, userId });
  });
}
