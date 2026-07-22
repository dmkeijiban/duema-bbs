create table if not exists public.deck_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_edit_token_hash text,
  title text not null,
  format text not null default 'original' check (format in ('original', 'advance')),
  deck_data jsonb not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deck_submissions_title_length check (char_length(title) between 1 and 60),
  constraint deck_submissions_deck_data_array check (jsonb_typeof(deck_data) = 'array'),
  constraint deck_submissions_owner_check check (user_id is not null or anonymous_edit_token_hash is not null)
);

create index if not exists deck_submissions_public_newest_idx
  on public.deck_submissions(created_at desc)
  where is_public = true;

alter table public.deck_submissions enable row level security;

revoke all on table public.deck_submissions from anon, authenticated;
grant all on table public.deck_submissions to service_role;

comment on table public.deck_submissions is 'デッキメーカーから公開された、みんなのデッキリスト';
comment on column public.deck_submissions.deck_data is 'サーバー側でカードDBと照合済みのデッキスナップショット';
