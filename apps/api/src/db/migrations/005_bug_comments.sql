CREATE TABLE bug_comments (
  id BIGSERIAL PRIMARY KEY,
  bug_id BIGINT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bug_comments_bug_id_created_at ON bug_comments(bug_id, created_at);
