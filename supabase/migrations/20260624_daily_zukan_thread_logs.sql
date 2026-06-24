-- daily_zukan_thread_logs:
-- 毎日自動生成する「思い出図鑑カードスレ」の生成履歴。
-- 周回（cycle_no）ごとに、同一カードを二度使わないための使用済み管理を兼ねる。
-- 全公開カードを使い切ったら cycle_no を +1 して再び全カードを未使用扱いにする。

CREATE TABLE IF NOT EXISTS daily_zukan_thread_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_slug   TEXT NOT NULL,
  thread_id   BIGINT REFERENCES threads(id) ON DELETE SET NULL,
  cycle_no    INT NOT NULL DEFAULT 1,
  posted_date DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1日1スレの保証（JST基準の posted_date を一意にする）。
-- 多重 Cron 起動時も2件目以降は 23505 で弾かれる。
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_zukan_posted_date
  ON daily_zukan_thread_logs (posted_date);

-- 周回内の使用済みカード検索を高速化。
CREATE INDEX IF NOT EXISTS idx_daily_zukan_cycle_slug
  ON daily_zukan_thread_logs (cycle_no, card_slug);

-- RLS: anon / authenticated にはポリシーを一切付与しない（= アクセス不可の内部テーブル）。
-- Cron（API route）と管理画面はいずれも service_role（createAdminClient）で読み書きし、
-- service_role は RLS をバイパスするため動作する。非登録ユーザー導線には一切露出しない。
ALTER TABLE daily_zukan_thread_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE daily_zukan_thread_logs IS '毎日自動生成する思い出図鑑カードスレの履歴・周回管理（service_role専用）';
