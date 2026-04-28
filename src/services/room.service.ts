import { Room, RoomType } from '../domain/room';
import { IRoomRepository } from '../repositories/room.repository';
import { NotFoundException } from '../exceptions';
import { Pool } from 'pg';

// ── Interface ────────────────────────────────────────────────────────────────

export interface IRoomService {
  getOrCreateDirectRoom(userA: string, userB: string): Promise<Room>;
  createGroupRoom(name: string, memberIds: string[]): Promise<Room>;
  assertMember(roomId: string, userId: string): Promise<void>;
  assertRoomExists(roomId: string): Promise<Room>;
  ensureUser(userId: string): Promise<void>;
}

// ── Implementation ───────────────────────────────────────────────────────────

export class RoomService implements IRoomService {
  constructor(
    private readonly roomRepo: IRoomRepository,
    private readonly db: Pool
  ) {}

  async getOrCreateDirectRoom(userA: string, userB: string): Promise<Room> {
    const existing = await this.roomRepo.findDirectRoom(userA, userB);
    if (existing) return existing;
    return this.roomRepo.createRoom(RoomType.DIRECT, null, [userA, userB]);
  }

  async createGroupRoom(name: string, memberIds: string[]): Promise<Room> {
    return this.roomRepo.createRoom(RoomType.GROUP, name, memberIds);
  }

  async assertMember(roomId: string, userId: string): Promise<void> {
    const isMember = await this.roomRepo.isMember(roomId, userId);
    if (!isMember) {
      throw new NotFoundException('room membership', `${userId} in room ${roomId}`);
    }
  }

  async assertRoomExists(roomId: string): Promise<Room> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) throw new NotFoundException('Room', roomId);
    return room;
  }

  async ensureUser(userId: string): Promise<void> {
    await this.db.query(
      'INSERT INTO users (id, display_name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING',
      [userId]
    );
  }
}
