import { MessageResponse } from '../dto/response/message.response';

// ── Pub/Sub event union ───────────────────────────────────────────────────────
// All events published to the Redis "chat" channel must conform to one of these shapes.

export type PubSubEvent =
  | { event: 'message:new';    roomId: string; msg: MessageResponse }
  | { event: 'user:online';    userId: string }
  | { event: 'user:offline';   userId: string }
  | { event: 'typing:started'; roomId: string; userId: string }
  | { event: 'typing:stopped'; roomId: string; userId: string };
