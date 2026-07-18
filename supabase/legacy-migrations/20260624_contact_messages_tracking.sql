-- contact_messages テーブルを作成（存在しない場合のみ）
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  email TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 送信元トラッキング用カラム（既存テーブルへの追加にも対応）
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS session_id TEXT NULL;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_id UUID NULL;

-- RLS 有効化（べき等）
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- INSERT ポリシー（重複エラーを避けるため DO ブロックで保護）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_messages' AND policyname = 'contact_insert'
  ) THEN
    CREATE POLICY "contact_insert" ON contact_messages FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contact_messages_session_id
  ON contact_messages (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON contact_messages (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
