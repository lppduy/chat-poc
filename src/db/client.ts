import { Pool } from 'pg';
import { config } from '../config';

export const db = new Pool(config.postgres);

export async function connectDb(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.log('[db] PostgreSQL connected');
}
