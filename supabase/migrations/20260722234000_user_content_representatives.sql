create table if not exists public.user_content_representatives (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('my_duema_9', 'deck')),
  content_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_type)
);

alter table public.user_content_representatives enable row level security;
revoke all on table public.user_content_representatives from anon, authenticated;

