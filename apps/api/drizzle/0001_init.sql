CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  bytes_used INTEGER NOT NULL DEFAULT 0,
  approved_script_job_id TEXT,
  approved_script_hash TEXT,
  approved_script_at TEXT,
  approved_master_job_id TEXT,
  approved_master_hash TEXT,
  approved_master_at TEXT,
  approved_thumb_job_id TEXT,
  approved_thumb_hash TEXT,
  approved_thumb_at TEXT,
  originality_checklist_json TEXT,
  publish_checklist_json TEXT
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  module TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  timeout_sec INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  claimed_by TEXT,
  input_hash TEXT NOT NULL,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  error_code TEXT,
  bytes_out INTEGER,
  cost_usd REAL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  gpu_sec REAL,
  stock_calls INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lease_until TEXT,
  deadline_at TEXT
);

CREATE UNIQUE INDEX jobs_idempotency ON jobs(project_id, idempotency_key);
CREATE INDEX jobs_status ON jobs(status, updated_at);
CREATE INDEX jobs_created ON jobs(status, module, created_at);
CREATE INDEX jobs_project ON jobs(project_id, created_at);
CREATE INDEX jobs_lease ON jobs(status, lease_until);

CREATE TABLE daily_usage (
  day TEXT PRIMARY KEY,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  stock_calls INTEGER NOT NULL DEFAULT 0
);
