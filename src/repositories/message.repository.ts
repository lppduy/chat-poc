import { Pool } from 'pg';
import { Message, MessagePage } from '../domain/message';

// ── Interface ────────────────────────────────────────────────────────────────

export interface IMessageRepository {
  save(roomId: string, senderId: string, content: string): Promise<Message>;
  findByRoom(roomId: string, cursor: string | null, limit: number): Promise<MessagePage>;
}

// ── DB row type (internal) ───────────────────────────────────────────────────

interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: Date;
}

// ── Mapper ───────────────────────────────────────────────────────────────────

function toMessage(row: MessageRow): Message {
  return new Message(row.id, row.room_id, row.sender_id, row.content, row.created_at);
}

// ── Implementation ───────────────────────────────────────────────────────────

export class MessageRepository implements IMessageRepository {
  constructor(private readonly db: Pool) {}

  async save(roomId: string, senderId: string, content: string): Promise<Message> {
    const res = await this.db.query<MessageRow>(
      `INSERT INTO messages (room_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, room_id, sender_id, content, created_at`,
      [roomId, senderId, content]
    );
    return toMessage(res.rows[0]);
  }

  // cursor-based pagination — stable even when new messages arrive
  async findByRoom(roomId: string, cursor: string | null, limit: number): Promise<MessagePage> {
    const pageSize = limit + 1; // fetch one extra to detect if there's a next page

    let rows: MessageRow[];
    if (cursor) {
      const res = await this.db.query<MessageRow>(
        `SELECT id, room_id, sender_id, content, created_at
         FROM messages
         WHERE room_id = $1 AND created_at < $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [roomId, cursor, pageSize]
      );
      rows = res.rows;
    } else {
      const res = await this.db.query<MessageRow>(
        `SELECT id, room_id, sender_id, content, created_at
         FROM messages
         WHERE room_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [roomId, pageSize]
      );
      rows = res.rows;
    }

    const hasMore = rows.length > limit;
    const messages = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? rows[limit].created_at.toISOString() : null;

    return new MessagePage(messages.map(toMessage), nextCursor);
  }
}
