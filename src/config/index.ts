import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
    database: process.env.POSTGRES_DB ?? 'chat',
    user: process.env.POSTGRES_USER ?? 'chat',
    password: process.env.POSTGRES_PASSWORD ?? 'chat',
  },

  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',

  presence: {
    ttlSeconds: 300,   // 5 minutes — auto-expire if server crashes without cleanup
  },

  typing: {
    ttlSeconds: 5,     // typing indicator auto-expires after 5s
  },
};
