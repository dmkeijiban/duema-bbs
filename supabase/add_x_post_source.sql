-- X投稿からスレ立てするための列追加
alter table threads
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_text_hash text;

-- 同一テキストの重複投稿を防ぐユニーク部分インデックス
-- NULL は除外することで既存スレッドと共存可能
create unique index if not exists idx_threads_source_text_hash
  on threads(source_text_hash)
  where source_text_hash is not null;
