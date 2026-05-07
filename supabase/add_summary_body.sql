-- 手動まとめの本文（手書き記事コンテンツ）用カラム
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS body TEXT;
