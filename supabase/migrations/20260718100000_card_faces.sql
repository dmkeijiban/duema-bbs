-- Additive multi-face catalog for deck search and future zukan use.
-- cards.id remains the logical card identity used by deck limits.
create table if not exists public.card_faces (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  card_printing_id uuid references public.card_printings(id) on delete cascade,
  side_index integer not null check (side_index >= 0),
  side_kind text,
  name text not null check (btrim(name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  name_kana text,
  card_number text,
  card_type text,
  image_url text,
  official_page_url text,
  extraction_status text not null default 'complete'
    check (extraction_status in ('complete', 'name_kana_pending', 'needs_review', 'failed')),
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_printing_id, side_index)
);

-- Keep reruns safe if a Preview applied an earlier draft of this additive migration.
alter table public.card_faces add column if not exists card_number text;
alter table public.card_faces add column if not exists card_type text;

create index if not exists card_faces_card_id_idx on public.card_faces(card_id);
create index if not exists card_faces_card_printing_id_idx on public.card_faces(card_printing_id);
create index if not exists card_faces_normalized_name_idx on public.card_faces(normalized_name);
create index if not exists card_faces_name_kana_idx on public.card_faces(name_kana) where name_kana is not null;
-- pg_trgm is already enabled by the existing card catalog migration. These indexes
-- are built while this new table is empty, so they do not lock existing card rows.
create index if not exists card_faces_normalized_name_trgm_idx on public.card_faces using gin(normalized_name gin_trgm_ops);
create index if not exists card_faces_name_kana_trgm_idx on public.card_faces using gin(name_kana gin_trgm_ops);

create table if not exists public.face_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  official_page_url text,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'not_modified', 'http_404', 'http_429', 'http_5xx', 'parse_failed', 'nonstandard_url', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  content_hash text,
  extracted_face_count integer check (extracted_face_count >= 0),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, official_page_url)
);

create index if not exists face_import_runs_status_idx on public.face_import_runs(status);
create index if not exists face_import_runs_checked_at_idx on public.face_import_runs(checked_at);

alter table public.card_faces enable row level security;
alter table public.face_import_runs enable row level security;

comment on table public.card_faces is 'A logical card face per printing; cards.id remains deck identity.';
comment on table public.face_import_runs is 'Incremental official face extraction state; safe to resume without refetching successes.';
