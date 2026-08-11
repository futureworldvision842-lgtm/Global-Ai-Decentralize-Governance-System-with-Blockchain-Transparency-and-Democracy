CREATE TABLE IF NOT EXISTS gaigs_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cnic_hash TEXT NOT NULL UNIQUE,
  cnic_last4 TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS gaigs_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  location_public INTEGER NOT NULL DEFAULT 0,
  lat_approx REAL,
  lng_approx REAL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'GCR',
  available INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'mvp',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_ledger_entries (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('credit','debit')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  entry_type TEXT NOT NULL,
  counterparty_wallet_id TEXT,
  reference_id TEXT,
  description TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(wallet_id) REFERENCES gaigs_wallets(id)
);

CREATE TABLE IF NOT EXISTS gaigs_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  post_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  body TEXT NOT NULL,
  location_label TEXT NOT NULL DEFAULT '',
  lat_approx REAL,
  lng_approx REAL,
  upload_id TEXT,
  reward_credits INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id),
  FOREIGN KEY(upload_id) REFERENCES gaigs_uploads(id)
);

CREATE TABLE IF NOT EXISTS gaigs_reward_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT NOT NULL,
  budget_credits INTEGER NOT NULL DEFAULT 0,
  rules_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'voting',
  yes_count INTEGER NOT NULL DEFAULT 0,
  no_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  project_wallet_id TEXT,
  created_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_votes (
  proposal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('yes','no','abstain')),
  vote_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(proposal_id,user_id),
  FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id),
  FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
);

CREATE TABLE IF NOT EXISTS gaigs_project_wallets (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'GCR',
  available INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved-unfunded',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id)
);

CREATE INDEX IF NOT EXISTS idx_gaigs_sessions_user_expiry ON gaigs_sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_ledger_wallet_time ON gaigs_ledger_entries(wallet_id,created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_posts_scope_time ON gaigs_posts(scope,created_at);
CREATE INDEX IF NOT EXISTS idx_gaigs_proposals_scope_time ON gaigs_proposals(scope,created_at);

PRAGMA optimize;
