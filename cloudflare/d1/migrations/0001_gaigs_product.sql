-- GAIGS product schema for a fresh D1 database.
-- Keep this aligned with PRODUCT_SCHEMA in sites/product-api.js.
-- The Worker also creates these tables on first use; applying the migration
-- makes a new account ready before the first request.

CREATE TABLE IF NOT EXISTS gaigs_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, password_iterations INTEGER NOT NULL,
  full_name TEXT NOT NULL, phone TEXT NOT NULL, cnic_hash TEXT NOT NULL UNIQUE,
  cnic_last4 TEXT NOT NULL, country TEXT NOT NULL, city TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0, kyc_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL, last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS gaigs_profiles (
  user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '', avatar_key TEXT, location_public INTEGER NOT NULL DEFAULT 0,
  lat_approx REAL, lng_approx REAL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_wallets (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'GCR',
  available INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'mvp', created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_ledger_entries (
  id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, direction TEXT NOT NULL,
  amount INTEGER NOT NULL, entry_type TEXT NOT NULL, counterparty_wallet_id TEXT,
  reference_id TEXT, description TEXT NOT NULL, previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
  FOREIGN KEY(wallet_id) REFERENCES gaigs_wallets(id)
);

CREATE TABLE IF NOT EXISTS gaigs_uploads (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL, original_name TEXT NOT NULL, byte_size INTEGER NOT NULL,
  purpose TEXT NOT NULL, created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_posts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL,
  post_type TEXT NOT NULL, scope TEXT NOT NULL, body TEXT NOT NULL,
  location_label TEXT NOT NULL DEFAULT '', lat_approx REAL, lng_approx REAL,
  upload_id TEXT, reward_credits INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id),
  FOREIGN KEY(upload_id) REFERENCES gaigs_uploads(id)
);

CREATE TABLE IF NOT EXISTS gaigs_reward_events (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_proposals (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, scope TEXT NOT NULL,
  description TEXT NOT NULL, evidence TEXT NOT NULL, budget_credits INTEGER NOT NULL DEFAULT 0,
  rules_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'voting',
  yes_count INTEGER NOT NULL DEFAULT 0, no_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0, project_wallet_id TEXT,
  created_at INTEGER NOT NULL, closes_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_votes (
  proposal_id TEXT NOT NULL, user_id TEXT NOT NULL, choice TEXT NOT NULL,
  vote_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
  PRIMARY KEY(proposal_id, user_id),
  FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id),
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_project_wallets (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'GCR',
  available INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved-unfunded', created_at INTEGER NOT NULL,
  FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id)
);

CREATE TABLE IF NOT EXISTS gaigs_device_keys (
  user_id TEXT NOT NULL, device_id TEXT NOT NULL, device_label TEXT NOT NULL,
  encryption_public_jwk TEXT NOT NULL, signing_public_jwk TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, revoked_at INTEGER,
  PRIMARY KEY(user_id, device_id), FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_private_messages (
  id TEXT PRIMARY KEY, client_message_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL, recipient_user_id TEXT NOT NULL, sender_device_id TEXT NOT NULL,
  message_kind TEXT NOT NULL, recipient_envelope TEXT NOT NULL, sender_envelope TEXT NOT NULL,
  reply_to TEXT, previous_hash TEXT NOT NULL, message_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, delivered_at INTEGER, read_at INTEGER,
  FOREIGN KEY(sender_user_id) REFERENCES gaigs_users(id),
  FOREIGN KEY(recipient_user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_room_messages (
  id TEXT PRIMARY KEY, room_type TEXT NOT NULL, room_key TEXT NOT NULL,
  user_id TEXT NOT NULL, display_name TEXT NOT NULL, body TEXT NOT NULL,
  reply_to TEXT, previous_hash TEXT NOT NULL, message_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE INDEX IF NOT EXISTS idx_gaigs_sessions_user_expiry ON gaigs_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_ledger_wallet_time ON gaigs_ledger_entries(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_posts_scope_time ON gaigs_posts(scope, created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_proposals_scope_time ON gaigs_proposals(scope, created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_device_keys_user_seen ON gaigs_device_keys(user_id, last_seen_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_client_sender ON gaigs_private_messages(sender_user_id, client_message_id);
CREATE INDEX IF NOT EXISTS idx_gaigs_private_recipient_time ON gaigs_private_messages(recipient_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_private_sender_time ON gaigs_private_messages(sender_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_private_conversation_time ON gaigs_private_messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_chain_tip ON gaigs_private_messages(conversation_id, previous_hash);
CREATE INDEX IF NOT EXISTS idx_gaigs_rooms_scope_time ON gaigs_room_messages(room_type, room_key, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_rooms_chain_tip ON gaigs_room_messages(room_type, room_key, previous_hash);
