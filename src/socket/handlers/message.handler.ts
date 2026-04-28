import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { IMessageService } from '../../services/message.service';
import { MessageResponseMapper } from '../../dto/response/message.response';
import { SendMessageRequest } from '../../dto/request/send-message.request';
import { GetHistoryRequest } from '../../dto/request/get-history.request';
import { publish, CHAT_CHANNEL } from '../../pubsub/redis.pubsub';
import { AppException } from '../../exceptions';

export function registerMessageHandler(
  io: Server,
  socket: Socket,
  messageService: IMessageService,
  pub: RedisClientType
): void {
  const userId = socket.data.userId as string;

  socket.on('message:send', async (req: SendMessageRequest, ack?: Function) => {
    try {
      // 1. persist first — source of truth
      const msg = await messageService.send(req.roomId, userId, req.content);
      const response = MessageResponseMapper.fromDomain(msg);

      // 2. broadcast via Redis Pub/Sub so all instances deliver the message
      await publish(pub, CHAT_CHANNEL, {
        event: 'message:new',
        roomId: req.roomId,
        msg: response,
      });

      if (ack) ack({ ok: true, messageId: msg.id });
    } catch (err) {
      console.error('[message] send error', err);
      const error = err instanceof AppException ? err.message : 'failed to send message';
      if (ack) ack({ ok: false, error });
    }
  });

  socket.on('history:get', async (req: GetHistoryRequest, ack?: Function) => {
    try {
      const page = await messageService.getHistory(req.roomId, req.cursor ?? null, req.limit ?? 20);
      const response = MessageResponseMapper.pageFromDomain(page);
      socket.emit('history:result', response);
      if (ack) ack({ ok: true });
    } catch (err) {
      console.error('[message] history error', err);
      const error = err instanceof AppException ? err.message : 'failed to fetch history';
      if (ack) ack({ ok: false, error });
    }
  });
}
