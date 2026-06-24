CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('post', 'thread')),
  item_id BIGINT NOT NULL,
  reason TEXT,
  item_body_excerpt TEXT,
  reporter_user_id UUID NULL,
  reporter_session_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_user_id ON reports (reporter_user_id) WHERE reporter_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_reporter_session_id ON reports (reporter_session_id) WHERE reporter_session_id IS NOT NULL;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_mutes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NULL,
  session_id TEXT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_report_mutes_active_user_id ON report_mutes (user_id) WHERE is_active = TRUE AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_mutes_active_session_id ON report_mutes (session_id) WHERE is_active = TRUE AND session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_mutes_created_at ON report_mutes (created_at DESC);

ALTER TABLE report_mutes ENABLE ROW LEVEL SECURITY;
