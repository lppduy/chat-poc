import { RedisClientType } from 'redis';
import { config } from '../config';

// ── Interface ────────────────────────────────────────────────────────────────

export interface IPresenceService {
  setOnline(userId: string, socketId: string): Promise<void>;
  setOffline(userId: string): Promise<void>;
  isOnline(userId: string): Promise<boolean>;
  getOnlineUsers(): Promise<string[]>;
  setTyping(roomId: string, userId: string): Promise<void>;
  clearTyping(roomId: string, userId: string): Promise<void>;
}

// ── Implementation ───────────────────────────────────────────────────────────

export class PresenceService implements IPresenceService {
  private readonly presenceKey = (userId: string) => `presence:${userId}`;
  private readonly typingKey = (roomId: string, userId: string) => `typing:${roomId}:${userId}`;

  constructor(private readonly redis: RedisClientType) {}

  async setOnline(userId: string, socketId: string): Promise<void> {
    await this.redis.set(this.presenceKey(userId), socketId, {
      EX: config.presence.ttlSeconds,
    });
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(this.presenceKey(userId));
  }

  async isOnline(userId: string): Promise<boolean> {
    const val = await this.redis.get(this.presenceKey(userId));
    return val !== null;
  }

  async getOnlineUsers(): Promise<string[]> {
    const keys = await this.redis.keys('presence:*');
    return keys.map((k) => k.replace('presence:', ''));
  }

  async setTyping(roomId: string, userId: string): Promise<void> {
    await this.redis.set(this.typingKey(roomId, userId), '1', {
      EX: config.typing.ttlSeconds,
    });
  }

  async clearTyping(roomId: string, userId: string): Promise<void> {
    await this.redis.del(this.typingKey(roomId, userId));
  }
}
