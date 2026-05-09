create table if not exists moderation_ng_words (
  id bigserial primary key,
  word text not null unique,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists moderation_bans (
  id bigserial primary key,
  ban_type text not null default 'session',
  ban_value text not null,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(ban_type, ban_value)
);

create index if not exists idx_moderation_ng_words_active
  on moderation_ng_words(is_active);

create index if not exists idx_moderation_bans_lookup
  on moderation_bans(ban_type, ban_value, is_active);

alter table moderation_ng_words enable row level security;
alter table moderation_bans enable row level security;

drop policy if exists "moderation_ng_words_select" on moderation_ng_words;
create policy "moderation_ng_words_select"
  on moderation_ng_words for select
  using (true);

drop policy if exists "moderation_bans_select" on moderation_bans;
create policy "moderation_bans_select"
  on moderation_bans for select
  using (true);
