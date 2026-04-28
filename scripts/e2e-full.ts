/**
 * E2E smoke test — full flow: connect → dm:start → message:send → history:get
 * Usage: npx ts-node scripts/e2e-full.ts
 */

import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:3001';
const TIMEOUT_MS = 5000;

let pass = 0;
let fail = 0;

function ok(msg: string) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
  pass++;
}

function err(msg: string, detail?: unknown) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`, detail ?? '');
  fail++;
}

function connect(userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(URL, {
      query: { userId },
      transports: ['websocket'],
      timeout: TIMEOUT_MS,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function waitFor<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), TIMEOUT_MS);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  console.log('\n── Flow 1: Connect ──');
  let alice: Socket, bob: Socket;
  try {
    [alice, bob] = await Promise.all([connect('alice'), connect('bob')]);
    ok('alice connected');
    ok('bob connected');
  } catch (e) {
    err('connect failed', e);
    process.exit(1);
  }

  console.log('\n── Flow 2: DM start ──');
  let roomId: string;
  try {
    const bobRoom = waitFor<{ roomId: string }>(bob, 'room:created');
    alice.emit('dm:start', { targetUserId: 'bob' });
    const { roomId: rid } = await bobRoom;
    roomId = rid;
    ok(`dm:start → roomId: ${roomId}`);
  } catch (e) {
    err('dm:start failed', e);
    alice.disconnect(); bob.disconnect();
    process.exit(1);
  }

  console.log('\n── Flow 3: Send message ──');
  try {
    const bobMsg = waitFor<{ content: string; senderId: string }>(bob, 'message:new');
    alice.emit('message:send', { roomId, content: 'hello bob!' });
    const { content, senderId } = await bobMsg;
    ok(`bob received message: "${content}" from ${senderId}`);
  } catch (e) {
    err('message:send failed', e);
  }

  console.log('\n── Flow 4: Message history ──');
  try {
    const historyResult = waitFor<{ messages: unknown[]; nextCursor: string | null }>(alice, 'history:result');
    alice.emit('history:get', { roomId });
    const { messages, nextCursor } = await historyResult;
    ok(`history: ${messages.length} message(s), nextCursor: ${nextCursor}`);
  } catch (e) {
    err('history:get failed', e);
  }

  console.log('\n── Flow 5: Typing indicator ──');
  try {
    const typingStart = waitFor<{ userId: string }>(bob, 'typing:started');
    alice.emit('typing:start', { roomId });
    const { userId } = await typingStart;
    ok(`bob received typing:started from ${userId}`);

    const typingStop = waitFor<{ userId: string }>(bob, 'typing:stopped');
    alice.emit('typing:stop', { roomId });
    await typingStop;
    ok('bob received typing:stopped');
  } catch (e) {
    err('typing indicator failed', e);
  }

  console.log('\n── Flow 6: Disconnect ──');
  try {
    const bobOffline = waitFor<{ userId: string }>(bob, 'user:offline');
    alice.disconnect();
    const { userId } = await bobOffline;
    ok(`bob received user:offline for ${userId}`);
  } catch (e) {
    err('disconnect flow failed', e);
  }

  bob.disconnect();

  console.log('\n────────────────────────────');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  console.log('────────────────────────────\n');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
