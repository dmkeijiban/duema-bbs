
-- threads に is_protected カラムを追加
-- is_protected=true のスレは自動アーカイブ・一括アーカイブの対象外
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

-- 管理者スレ（「デュエマ掲示板の使い方」id=22）を保護
UPDATE threads SET is_protected = true WHERE id = 22;

-- インデックス（自動アーカイブクエリで使用）
CREATE INDEX IF NOT EXISTS idx_threads_auto_archive
  ON threads (is_archived, is_protected, created_at)
  WHERE is_archived = false AND is_protected = false;
;
