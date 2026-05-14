alter table summaries add column if not exists view_count int not null default 0;

create table if not exists summary_comments (
  id bigserial primary key,
  summary_id bigint not null references summaries(id) on delete cascade,
  comment_number int not null,
  body text not null,
  author_name text not null default '名無しさん',
  session_id text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  unique(summary_id, comment_number)
);

create index if not exists idx_summary_comments_summary
  on summary_comments(summary_id, comment_number)
  where is_deleted = false;

alter table summary_comments enable row level security;

drop policy if exists "summary_comments_select" on summary_comments;
create policy "summary_comments_select"
  on summary_comments for select using (is_deleted = false);

drop policy if exists "summary_comments_insert" on summary_comments;
create policy "summary_comments_insert"
  on summary_comments for insert with check (true);

create or replace function increment_summary_view_count(summary_slug text)
returns void as $$
begin
  update summaries
  set view_count = coalesce(view_count, 0) + 1
  where slug = summary_slug;
end;
$$ language plpgsql security definer;
