import fs from 'fs';
import path from 'path';
import { db, connectDb } from './client';

async function migrate(): Promise<void> {
  await connectDb();

  const schemaPath = path.join(process.cwd(), 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  await db.query(sql);
  console.log('[migrate] schema applied');
  await db.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
