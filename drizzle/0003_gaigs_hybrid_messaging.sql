CREATE TABLE IF NOT EXISTS gaigs_device_keys (
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_label TEXT NOT NULL,
  encryption_public_jwk TEXT NOT NULL,
  signing_public_jwk TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY(user_id, device_id),
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_private_messages (
  id TEXT PRIMARY KEY,
  client_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  sender_device_id TEXT NOT NULL,
  message_kind TEXT NOT NULL,
  recipient_envelope TEXT NOT NULL,
  sender_envelope TEXT NOT NULL,
  reply_to TEXT,
  previous_hash TEXT NOT NULL,
  message_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  read_at INTEGER,
  FOREIGN KEY(sender_user_id) REFERENCES gaigs_users(id),
  FOREIGN KEY(recipient_user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_room_messages (
  id TEXT PRIMARY KEY,
  room_type TEXT NOT NULL,
  room_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  reply_to TEXT,
  previous_hash TEXT NOT NULL,
  message_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE INDEX IF NOT EXISTS idx_gaigs_device_keys_user_seen
ON gaigs_device_keys(user_id, last_seen_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_client_sender
ON gaigs_private_messages(sender_user_id, client_message_id);

CREATE INDEX IF NOT EXISTS idx_gaigs_private_recipient_time
ON gaigs_private_messages(recipient_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_gaigs_private_sender_time
ON gaigs_private_messages(sender_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_gaigs_private_conversation_time
ON gaigs_private_messages(conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_chain_tip
ON gaigs_private_messages(conversation_id, previous_hash);

CREATE INDEX IF NOT EXISTS idx_gaigs_rooms_scope_time
ON gaigs_room_messages(room_type, room_key, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_rooms_chain_tip
ON gaigs_room_messages(room_type, room_key, previous_hash);

PRAGMA optimize;
