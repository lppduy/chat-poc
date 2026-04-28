import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

export const CHAT_CHANNEL = 'chat';

// pub and sub must be separate clients
// once SUBSCRIBE is called, the client enters listening mode and cannot do other commands
export async function createRedisClients(): Promise<{
  pub: RedisClientType;
  sub: RedisClientType;
}> {
  const pub = createClient({ url: config.redisUrl }) as RedisClientType;
  const sub = createClient({ url: config.redisUrl }) as RedisClientType;

  await pub.connect();
  await sub.connect();

  console.log('[redis] pub/sub clients connected');
  return { pub, sub };
}

export async function publish(
  pub: RedisClientType,
  channel: string,
  payload: object
): Promise<void> {
  await pub.publish(channel, JSON.stringify(payload));
}

export async function subscribe(
  sub: RedisClientType,
  channel: string,
  handler: (payload: object) => void
): Promise<void> {
  await sub.subscribe(channel, (raw) => {
    try {
      handler(JSON.parse(raw));
    } catch {
      console.error('[pubsub] failed to parse message:', raw);
    }
  });
}
