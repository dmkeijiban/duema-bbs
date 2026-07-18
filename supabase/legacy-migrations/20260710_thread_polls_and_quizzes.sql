-- スレッドに2〜4択の投票・クイズを追加する。
-- 選択肢と票はスレッド本文から分離し、クイズの正解は投票前の公開レスポンスへ出さない。

create table if not exists public.thread_polls (
  thread_id bigint primary key references public.threads(id) on delete cascade,
  kind text not null check (kind in ('poll', 'quiz')),
  created_at timestamptz not null default now()
);

create table if not exists public.thread_poll_options (
  id bigserial primary key,
  thread_id bigint not null references public.thread_polls(thread_id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  image_url text,
  sort_order smallint not null check (sort_order between 0 and 3),
  is_correct boolean not null default false,
  vote_count integer not null default 0 check (vote_count >= 0),
  unique (thread_id, sort_order),
  unique (id, thread_id)
);

create unique index if not exists idx_thread_poll_one_correct
  on public.thread_poll_options(thread_id)
  where is_correct;

create table if not exists public.thread_poll_votes (
  id bigserial primary key,
  thread_id bigint not null references public.thread_polls(thread_id) on delete cascade,
  option_id bigint not null,
  session_id text not null,
  user_id uuid,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint thread_poll_votes_option_thread_fk
    foreign key (option_id, thread_id)
    references public.thread_poll_options(id, thread_id)
    on delete cascade,
  unique (thread_id, session_id)
);

create unique index if not exists idx_thread_poll_votes_user
  on public.thread_poll_votes(thread_id, user_id)
  where user_id is not null;

create index if not exists idx_thread_poll_votes_ip_created
  on public.thread_poll_votes(ip_hash, created_at desc)
  where ip_hash is not null;

create or replace function public.increment_thread_poll_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.thread_poll_options
  set vote_count = vote_count + 1
  where id = new.option_id and thread_id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_increment_thread_poll_vote_count on public.thread_poll_votes;
create trigger trg_increment_thread_poll_vote_count
  after insert on public.thread_poll_votes
  for each row execute function public.increment_thread_poll_vote_count();

create or replace function public.create_interactive_thread(
  p_title text,
  p_body text,
  p_author_name text,
  p_category_id integer,
  p_image_url text,
  p_thumbnail_url text,
  p_image_width integer,
  p_image_height integer,
  p_session_id text,
  p_user_id uuid,
  p_kind text,
  p_options jsonb
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_thread_id bigint;
  v_option jsonb;
  v_index integer := 0;
  v_option_count integer;
  v_correct_count integer;
begin
  if p_kind not in ('poll', 'quiz') then
    raise exception 'invalid poll kind';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'options must be an array';
  end if;

  v_option_count := jsonb_array_length(p_options);
  if v_option_count < 2 or v_option_count > 4 then
    raise exception 'poll must have 2 to 4 options';
  end if;

  select count(*) into v_correct_count
  from jsonb_array_elements(p_options) as option_row
  where coalesce((option_row->>'is_correct')::boolean, false);

  if (p_kind = 'quiz' and v_correct_count <> 1)
    or (p_kind = 'poll' and v_correct_count <> 0) then
    raise exception 'invalid correct option count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as option_row
    where char_length(btrim(coalesce(option_row->>'label', ''))) not between 1 and 60
  ) then
    raise exception 'invalid option label';
  end if;

  insert into public.threads (
    title,
    body,
    author_name,
    category_id,
    image_url,
    thumbnail_url,
    image_width,
    image_height,
    session_id,
    user_id
  ) values (
    p_title,
    p_body,
    p_author_name,
    p_category_id,
    p_image_url,
    p_thumbnail_url,
    p_image_width,
    p_image_height,
    p_session_id,
    p_user_id
  ) returning id into v_thread_id;

  insert into public.thread_polls (thread_id, kind)
  values (v_thread_id, p_kind);

  for v_option in select value from jsonb_array_elements(p_options)
  loop
    insert into public.thread_poll_options (
      thread_id,
      label,
      image_url,
      sort_order,
      is_correct
    ) values (
      v_thread_id,
      btrim(v_option->>'label'),
      nullif(btrim(coalesce(v_option->>'image_url', '')), ''),
      v_index,
      coalesce((v_option->>'is_correct')::boolean, false)
    );
    v_index := v_index + 1;
  end loop;

  return v_thread_id;
end;
$$;

alter table public.thread_polls enable row level security;
alter table public.thread_poll_options enable row level security;
alter table public.thread_poll_votes enable row level security;

-- 一覧で種別バッジを出せるよう、正解を含まない親レコードだけ公開する。
drop policy if exists "thread_polls_select" on public.thread_polls;
create policy "thread_polls_select"
  on public.thread_polls for select
  using (true);

revoke all on function public.create_interactive_thread(
  text, text, text, integer, text, text, integer, integer, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_interactive_thread(
  text, text, text, integer, text, text, integer, integer, text, uuid, text, jsonb
) to service_role;
