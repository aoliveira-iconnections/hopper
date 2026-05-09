-- 1. Make sure every reporter from seed data exists as a user.
--    Placeholder hash means they exist for attribution but cannot log in.
--    The demo user (Maya) keeps her real password if she's already there;
--    otherwise she'll be upserted by code in `ensureDemoUserPassword`.
INSERT INTO users (email, name, role, password_hash) VALUES
  ('maya@iconnections.io',  'Maya Patel',    'Customer Success',  'disabled:disabled'),
  ('sam@iconnections.io',   'Sam Chen',      'Engineering',       'disabled:disabled'),
  ('jules@iconnections.io', 'Jules Romero',  'Engineering Lead',  'disabled:disabled'),
  ('priya@iconnections.io', 'Priya Shah',    'Engineering',       'disabled:disabled'),
  ('devon@iconnections.io', 'Devon Liu',     'Engineering',       'disabled:disabled'),
  ('ana@iconnections.io',   'Ana Reyes',     'Customer Success',  'disabled:disabled')
ON CONFLICT (email) DO NOTHING;

-- 2. Add the FK column (nullable for backfill).
ALTER TABLE bugs ADD COLUMN reporter_id INTEGER REFERENCES users(id);

-- 3. Backfill: match existing bugs to users by email.
UPDATE bugs b
SET reporter_id = u.id
FROM users u
WHERE LOWER(u.email) = LOWER(b.reporter_email);

-- 4. Fallback for unmatched rows (test bugs filed during dev with arbitrary
--    emails like test@…, you@…, qa@…). Attribute them to the demo user.
UPDATE bugs SET reporter_id = (
  SELECT id FROM users WHERE email = 'maya@iconnections.io' LIMIT 1
) WHERE reporter_id IS NULL;

-- 5. Enforce the relationship.
ALTER TABLE bugs ALTER COLUMN reporter_id SET NOT NULL;

-- 6. Drop the freeform columns — users table is now the source of truth.
ALTER TABLE bugs DROP COLUMN reporter;
ALTER TABLE bugs DROP COLUMN reporter_email;

-- 7. Index for lookups by reporter.
CREATE INDEX idx_bugs_reporter_id ON bugs(reporter_id);
