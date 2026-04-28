import { MessageResponse, MessagePageResponse } from '../dto/response/message.response';
import { RoomResponse } from '../dto/response/room.response';
import { SendMessageRequest } from '../dto/request/send-message.request';
import { CreateRoomRequest, DmStartRequest } from '../dto/request/create-room.request';
import { GetHistoryRequest } from '../dto/request/get-history.request';

// ── Ack helper ───────────────────────────────────────────────────────────────

export interface AckOk { ok: true; roomId?: string; messageId?: string }
export interface AckErr { ok: false; error: string }
export type AckFn = (res: AckOk | AckErr) => void;

// ── Server → Client events ───────────────────────────────────────────────────

export interface ServerToClientEvents {
  'room:created':    (room: RoomResponse) => void;
  'message:new':     (msg: MessageResponse) => void;
  'history:result':  (page: MessagePageResponse) => void;
  'user:online':     (data: { userId: string }) => void;
  'user:offline':    (data: { userId: string }) => void;
  'typing:started':  (data: { userId: string; roomId: string }) => void;
  'typing:stopped':  (data: { userId: string; roomId: string }) => void;
}

// ── Client → Server events ───────────────────────────────────────────────────

export interface ClientToServerEvents {
  'dm:start':      (req: DmStartRequest,    ack: AckFn) => void;
  'room:create':   (req: CreateRoomRequest, ack: AckFn) => void;
  'room:join':     (req: { roomId: string }, ack: AckFn) => void;
  'message:send':  (req: SendMessageRequest, ack: AckFn) => void;
  'history:get':   (req: GetHistoryRequest,  ack: AckFn) => void;
  'typing:start':  (data: { roomId: string }) => void;
  'typing:stop':   (data: { roomId: string }) => void;
}

// ── Inter-server events (Socket.io cluster adapter — not used here) ──────────

export type InterServerEvents = Record<string, never>;

// ── Per-socket data ──────────────────────────────────────────────────────────

export interface SocketData {
  userId: string;
}
