import { Message, MessagePage } from '../domain/message';
import { IMessageRepository } from '../repositories/message.repository';
import { IRoomRepository } from '../repositories/room.repository';
import { ForbiddenException } from '../exceptions';

// ── Interface ────────────────────────────────────────────────────────────────

export interface IMessageService {
  send(roomId: string, senderId: string, content: string): Promise<Message>;
  getHistory(roomId: string, cursor: string | null, limit?: number): Promise<MessagePage>;
}

// ── Implementation ───────────────────────────────────────────────────────────

export class MessageService implements IMessageService {
  constructor(
    private readonly messageRepo: IMessageRepository,
    private readonly roomRepo: IRoomRepository
  ) {}

  async send(roomId: string, senderId: string, content: string): Promise<Message> {
    const isMember = await this.roomRepo.isMember(roomId, senderId);
    if (!isMember) {
      throw new ForbiddenException(`user ${senderId} is not a member of room ${roomId}`);
    }
    return this.messageRepo.save(roomId, senderId, content);
  }

  async getHistory(roomId: string, cursor: string | null, limit = 20): Promise<MessagePage> {
    return this.messageRepo.findByRoom(roomId, cursor, limit);
  }
}
