ALTER TABLE bugs
  ADD COLUMN assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_bugs_assignee_id ON bugs(assignee_id);
