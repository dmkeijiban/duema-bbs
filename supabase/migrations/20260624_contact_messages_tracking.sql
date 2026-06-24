ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS session_id TEXT NULL;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_session_id
  ON contact_messages (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON contact_messages (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
