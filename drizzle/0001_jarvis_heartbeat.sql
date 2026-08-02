CREATE TABLE IF NOT EXISTS jarvis_heartbeat (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  updated_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
