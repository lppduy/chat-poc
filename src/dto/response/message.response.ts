import { Message, MessagePage } from '../../domain/message';

export interface MessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface MessagePageResponse {
  messages: MessageResponse[];
  nextCursor: string | null;
}

export class MessageResponseMapper {
  static fromDomain(msg: Message): MessageResponse {
    return {
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  static pageFromDomain(page: MessagePage): MessagePageResponse {
    return {
      messages: page.messages.map(MessageResponseMapper.fromDomain),
      nextCursor: page.nextCursor,
    };
  }
}
