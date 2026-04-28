# Chat PoC

Real-time chat system: 1-1 DM, group rooms, online presence, typing indicator, message history.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Node.js 20 + TypeScript |
| Realtime | Socket.io 4 (WebSocket) |
| Pub/Sub | Redis 7 (cross-instance broadcast) |
| Database | PostgreSQL 16 |
| Container | Docker Compose |

## Features

- **1-1 DM** — `dm:start` creates or resumes a direct room
- **Group chat** — `room:create` with N members
- **Online presence** — Redis key with TTL, auto-expires on crash
- **Typing indicator** — Redis TTL-based, auto-clears after 5s
- **Message history** — cursor-based pagination (stable under live traffic)
- **Horizontal scale** — Redis Pub/Sub bridges messages across instances

## Scaling Architecture

```
Instance 1                Redis Pub/Sub              Instance 2
  alice ─ socket           channel: "chat"             bob ─ socket
     │                          │                          │
     ├─ message:send             │                          │
     ├─ publish(msg) ───────────>│                          │
     │                          ├─────── fan-out ──────────>│
     │                          │                          ├─ io.to(room).emit
     │                          │                          └─> bob receives
```

Without Redis Pub/Sub, `io.to(roomId).emit()` only reaches sockets on the **same instance**.

## Socket Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `dm:start` | `{ targetUserId }` | Start or resume 1-1 DM |
| `room:create` | `{ name, memberIds }` | Create group room |
| `room:join` | `{ roomId }` | Join existing room |
| `message:send` | `{ roomId, content }` | Send message |
| `history:get` | `{ roomId, cursor?, limit? }` | Load message history |
| `typing:start` | `{ roomId }` | Start typing indicator |
| `typing:stop` | `{ roomId }` | Stop typing indicator |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `room:created` | `{ roomId, type, members }` | Room ready |
| `message:new` | `{ id, roomId, senderId, content, createdAt }` | New message |
| `history:result` | `{ messages, nextCursor }` | History page |
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId }` | User went offline |
| `typing:started` | `{ userId, roomId }` | User is typing |
| `typing:stopped` | `{ userId, roomId }` | User stopped typing |

## Getting Started

### 1. Start infrastructure

```bash
cd infra
docker compose up -d
# postgres:5433  redis:6380
```

### 2. Install & migrate

```bash
npm install
cp .env.example .env
npm run migrate
```

### 3. Run server

```bash
npm run dev
# listening on port 3001
```

### 4. Test with wscat

```bash
npm install -g wscat

# Terminal 1 — alice
wscat -c "ws://localhost:3001/socket.io/?userId=alice&EIO=4&transport=websocket"

# Terminal 2 — bob
wscat -c "ws://localhost:3001/socket.io/?userId=bob&EIO=4&transport=websocket"
```

After connecting, send Socket.io events:

```
# alice starts DM with bob (paste into alice terminal)
42["dm:start",{"targetUserId":"bob"}]

# alice sends message (use roomId from dm:start response)
42["message:send",{"roomId":"<room-id>","content":"hello bob!"}]

# alice loads history
42["history:get",{"roomId":"<room-id>"}]

# alice typing
42["typing:start",{"roomId":"<room-id>"}]
```

> **Note:** `42` is the Socket.io framing prefix for events.

### 5. Run E2E test

```bash
./scripts/e2e-test.sh
```

## Architecture

```
Handler → Service → Repository → PostgreSQL
                 ↘ PresenceService → Redis
                 ↘ Pub/Sub → Redis → all instances → emit to clients
```

Each layer is **interface-driven** — handlers depend on service interfaces, services depend on repository interfaces. Concrete implementations are wired in `app.ts`.

```
domain/        ← entity classes, enums (no dependencies)
exceptions/    ← AppException hierarchy
repositories/  ← IXxxRepository interface + XxxRepository class (pg queries)
services/      ← IXxxService interface + XxxService class (business logic)
dto/           ← request types, response types + static mappers (fromDomain)
socket/        ← handlers (receive DTO → call service → emit response DTO)
app.ts         ← manual DI wiring + Redis Pub/Sub fan-out
```

## Project Structure

```
chat-poc/
├── infra/
│   └── docker-compose.yml
├── scripts/
│   └── e2e-test.sh
├── src/
│   ├── config/index.ts
│   ├── db/
│   │   ├── client.ts              # pg Pool
│   │   └── migrate.ts
│   ├── pubsub/
│   │   └── redis.pubsub.ts        # separate pub + sub clients
│   ├── domain/
│   │   ├── message.ts             # Message, MessagePage
│   │   ├── room.ts                # Room, RoomType enum
│   │   └── user.ts                # User
│   ├── exceptions/
│   │   ├── app.exception.ts       # base AppException(message, code)
│   │   ├── not-found.exception.ts
│   │   └── forbidden.exception.ts
│   ├── repositories/
│   │   ├── message.repository.ts  # IMessageRepository + MessageRepository
│   │   └── room.repository.ts     # IRoomRepository + RoomRepository
│   ├── services/
│   │   ├── message.service.ts     # IMessageService + MessageService
│   │   ├── presence.service.ts    # IPresenceService + PresenceService
│   │   └── room.service.ts        # IRoomService + RoomService
│   ├── dto/
│   │   ├── request/
│   │   │   ├── send-message.request.ts
│   │   │   ├── create-room.request.ts
│   │   │   └── get-history.request.ts
│   │   └── response/
│   │       ├── message.response.ts  # MessageResponseMapper.fromDomain()
│   │       └── room.response.ts     # RoomResponseMapper.fromDomain()
│   ├── socket/
│   │   ├── handlers/
│   │   │   ├── message.handler.ts
│   │   │   ├── presence.handler.ts
│   │   │   └── room.handler.ts
│   │   └── index.ts               # middleware + DI injection + register handlers
│   └── app.ts                     # bootstrap + manual DI wiring
├── schema.sql
├── .env.example
├── package.json
└── tsconfig.json
```

## Out of Scope (PoC)

- Authentication — `userId` passed as query param, no JWT
- Read receipts
- File/image uploads
- Push notifications (background)
- Kubernetes — Docker Compose only
