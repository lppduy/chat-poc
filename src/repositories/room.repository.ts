import { Pool } from 'pg';
import { Room, RoomType } from '../domain/room';

// ── Interface ────────────────────────────────────────────────────────────────

export interface IRoomRepository {
  findById(roomId: string): Promise<Room | null>;
  findDirectRoom(userA: string, userB: string): Promise<Room | null>;
  createRoom(type: RoomType, name: string | null, memberIds: string[]): Promise<Room>;
  isMember(roomId: string, userId: string): Promise<boolean>;
  getMembers(roomId: string): Promise<string[]>;
}

// ── DB row (internal — never exposed outside this file) ─────────────────────

interface RoomRow {
  id: string;
  name: string | null;
  type: string;
  created_at: Date;
}

// ── Mapper ───────────────────────────────────────────────────────────────────

function toRoom(row: RoomRow, members: string[] = []): Room {
  return new Room(row.id, row.type as RoomType, row.name, row.created_at, members);
}

// ── Implementation ───────────────────────────────────────────────────────────

export class RoomRepository implements IRoomRepository {
  constructor(private readonly db: Pool) {}

  async findById(roomId: string): Promise<Room | null> {
    const res = await this.db.query<RoomRow>(
      'SELECT id, name, type, created_at FROM rooms WHERE id = $1',
      [roomId]
    );
    if (!res.rows[0]) return null;
    const members = await this.getMembers(roomId);
    return toRoom(res.rows[0], members);
  }

  async findDirectRoom(userA: string, userB: string): Promise<Room | null> {
    const res = await this.db.query<RoomRow>(
      `SELECT r.id, r.name, r.type, r.created_at
       FROM rooms r
       JOIN room_members m1 ON m1.room_id = r.id AND m1.user_id = $1
       JOIN room_members m2 ON m2.room_id = r.id AND m2.user_id = $2
       WHERE r.type = 'direct'
       LIMIT 1`,
      [userA, userB]
    );
    if (!res.rows[0]) return null;
    return toRoom(res.rows[0], [userA, userB]);
  }

  async createRoom(type: RoomType, name: string | null, memberIds: string[]): Promise<Room> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const roomRes = await client.query<RoomRow>(
        'INSERT INTO rooms (name, type) VALUES ($1, $2) RETURNING id, name, type, created_at',
        [name, type]
      );
      const row = roomRes.rows[0];

      for (const userId of memberIds) {
        await client.query(
          'INSERT INTO users (id, display_name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING',
          [userId]
        );
        await client.query(
          'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
          [row.id, userId]
        );
      }

      await client.query('COMMIT');
      return toRoom(row, memberIds);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const res = await this.db.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getMembers(roomId: string): Promise<string[]> {
    const res = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM room_members WHERE room_id = $1',
      [roomId]
    );
    return res.rows.map((r) => r.user_id);
  }
}
