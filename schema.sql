CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  name TEXT,
  phone TEXT,
  birth_date TEXT,
  birth_time TEXT,
  birth_location TEXT,
  onboarding_complete INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'free',
  subscription_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text',
  content TEXT,
  feature TEXT,
  reaction TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_configs (
  feature TEXT PRIMARY KEY,
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  skill_md_path TEXT,
  reference_md_path TEXT,
  extra_skill_paths TEXT,
  enabled INTEGER DEFAULT 1,
  max_tokens INTEGER DEFAULT 8000,
  natal_source_systems TEXT DEFAULT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_line_user_id ON messages(line_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_events_line_user_id ON events(line_user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

CREATE TABLE IF NOT EXISTS daily_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL,
  cache_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(line_user_id, cache_type, created_at)
);

CREATE TABLE IF NOT EXISTS message_quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL,
  quota_date TEXT NOT NULL,
  messages_used INTEGER DEFAULT 0,
  UNIQUE(line_user_id, quota_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_cache_user ON daily_cache(line_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_cache_type ON daily_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_quotas_user_date ON message_quotas(line_user_id, quota_date);

CREATE TABLE IF NOT EXISTS pending_results (
  id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  params TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pending_results_user ON pending_results(line_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_results_status ON pending_results(status);
