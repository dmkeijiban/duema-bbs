-- ソフトデリート用カラムの追加（初回のみ実行）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_by TEXT;
CREATE INDEX IF NOT EXISTS posts_is_deleted_idx ON posts(is_deleted) WHERE is_deleted = true;

-- レス削除時にpost_countを正確な値に再計算するRPC（is_deleted=falseのみカウント）
CREATE OR REPLACE FUNCTION recalculate_post_count(p_thread_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE threads
  SET post_count = (
    SELECT COUNT(*) FROM posts
    WHERE thread_id = p_thread_id
      AND is_deleted = false
  )
  WHERE id = p_thread_id;
END;
$$;

-- 既存スレッドのpost_countを一括修正（初回のみ実行）
UPDATE threads
SET post_count = (
  SELECT COUNT(*) FROM posts
  WHERE posts.thread_id = threads.id
    AND posts.is_deleted = false
);
