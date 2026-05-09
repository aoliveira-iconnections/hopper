CREATE TABLE bug_attachments (
  id BIGSERIAL PRIMARY KEY,
  bug_id BIGINT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bug_attachments_bug_id ON bug_attachments(bug_id);
