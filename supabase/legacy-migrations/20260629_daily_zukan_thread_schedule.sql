-- daily_zukan_thread_schedule:
-- 毎日自動生成する「思い出図鑑カードスレ」の未来予定カードを保存する。
-- 未来予定は daily_zukan_thread_logs には入れず、この専用テーブルで管理する。
-- 実際のスレ作成が成功した日だけ daily_zukan_thread_logs に履歴を残す。

CREATE TABLE IF NOT EXISTS daily_zukan_thread_schedule (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scheduled_date DATE NOT NULL UNIQUE,
  card_slug      TEXT NOT NULL REFERENCES zukan_cards(slug) ON UPDATE CASCADE,
  status         TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed', 'error')),
  thread_id      BIGINT REFERENCES threads(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  error          TEXT
);

-- 当日予定の取得・未完了予定の一覧確認を想定。
CREATE INDEX IF NOT EXISTS idx_daily_zukan_schedule_status_date
  ON daily_zukan_thread_schedule (status, scheduled_date);

-- カード別の予定・完了履歴確認を想定。
CREATE INDEX IF NOT EXISTS idx_daily_zukan_schedule_card_slug
  ON daily_zukan_thread_schedule (card_slug);

-- RLS: anon / authenticated にはポリシーを一切付与しない（= アクセス不可の内部テーブル）。
-- Cron（API route）と管理画面はいずれも service_role（createAdminClient）で読み書きし、
-- service_role は RLS をバイパスするため動作する。非登録ユーザー導線には一切露出しない。
ALTER TABLE daily_zukan_thread_schedule ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE daily_zukan_thread_schedule IS '思い出図鑑カードスレの未来予定カード管理（service_role専用）';
COMMENT ON COLUMN daily_zukan_thread_schedule.scheduled_date IS 'このカードをdaily-zukan-threadで使う予定日（JST基準の日付）';
COMMENT ON COLUMN daily_zukan_thread_schedule.card_slug IS '予定対象のzukan_cards.slug';
COMMENT ON COLUMN daily_zukan_thread_schedule.status IS 'planned / completed / error';
COMMENT ON COLUMN daily_zukan_thread_schedule.thread_id IS '当日作成された掲示板スレID。作成前はNULL';
