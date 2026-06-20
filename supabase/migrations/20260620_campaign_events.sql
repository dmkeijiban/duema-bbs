-- campaign_events: 複数キャンペーンランキングを管理するテーブル。
-- site_settings の campaign_* キーは互換用に残す（後方互換フォールバック）。

CREATE TABLE IF NOT EXISTS campaign_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  start_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ NOT NULL,
  prize      TEXT NOT NULL DEFAULT '',
  rules_url  TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaign_events_end_after_start CHECK (end_at > start_at)
);

-- RLS: anon/authenticated は SELECT のみ。service_role は RLS バイパスで全操作可。
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_events_select_public"
  ON campaign_events
  FOR SELECT
  USING (true);

-- updated_at 自動更新（update_updated_at_column は他マイグレーションで定義済み。CREATE OR REPLACE で冪等に再定義する）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER campaign_events_updated_at
  BEFORE UPDATE ON campaign_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE campaign_events IS 'キャンペーンランキングイベント管理（1行=1キャンペーン）';
