CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS bugs (
  id              SERIAL PRIMARY KEY,
  duplicate_of    INTEGER REFERENCES bugs(id),
  title           TEXT NOT NULL,
  what            TEXT NOT NULL,
  expected        TEXT NOT NULL DEFAULT '',
  affected        TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  when_hint       TEXT NOT NULL DEFAULT 'Just now',
  severity        TEXT NOT NULL DEFAULT 'medium',
  status          TEXT NOT NULL DEFAULT 'new',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  reporter        TEXT NOT NULL DEFAULT '',
  reporter_email  TEXT NOT NULL DEFAULT '',
  slack_ts        TEXT,
  slack_channel   TEXT,
  embedding       vector(768),
  resolution      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bugs_duplicate_of ON bugs(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_tags ON bugs USING GIN(tags);
