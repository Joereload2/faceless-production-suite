CREATE TABLE outliers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  views INTEGER,
  vph REAL,
  subscribers INTEGER,
  ratio REAL,
  captured_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE UNIQUE INDEX outliers_project_video ON outliers(project_id, video_id);
