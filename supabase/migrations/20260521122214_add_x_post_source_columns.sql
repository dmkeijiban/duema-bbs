alter table threads
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_text_hash text;

create unique index if not exists idx_threads_source_text_hash
  on threads(source_text_hash)
  where source_text_hash is not null;;
