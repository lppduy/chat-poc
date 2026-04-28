-- Users (no auth, userId is passed by client directly)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms: type=direct (1-1) | type=group
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room members
CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for cursor-based pagination: room + time
CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON messages(room_id, created_at DESC);

-- Index for direct room lookup
CREATE INDEX IF NOT EXISTS idx_room_members_user
  ON room_members(user_id);
