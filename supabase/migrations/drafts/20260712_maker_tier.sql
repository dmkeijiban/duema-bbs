-- DRAFT: Preview専用DBでのみ適用する共通メーカー基盤。
create table if not exists public.maker_projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  type text not null check (type in ('tier','prediction','selection')), status text not null default 'draft',
  is_public boolean not null default false, config jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.maker_project_cards (
  project_id uuid not null references public.maker_projects(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade, sort_order integer not null default 0,
  primary key(project_id, card_id)
);
create table if not exists public.maker_submissions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.maker_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, is_valid boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,user_id)
);
create table if not exists public.maker_submission_items (
  submission_id uuid not null references public.maker_submissions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade, group_key text not null,
  position integer not null default 0, primary key(submission_id,card_id)
);
alter table public.maker_projects enable row level security;
alter table public.maker_project_cards enable row level security;
alter table public.maker_submissions enable row level security;
alter table public.maker_submission_items enable row level security;
-- 初期は公開policyを作らず、管理者Server Actionのservice roleだけで操作する。
insert into public.maker_projects(slug,title,type,status,is_public,config)
values ('dm26-ex2-charisma-best-tier','DM26-EX2 悪感謝祭 カリスマBEST Tier表','tier','draft',false,
  '{"groups":[{"key":"s","label":"S"},{"key":"a","label":"A"},{"key":"b","label":"B"},{"key":"c","label":"C"},{"key":"d","label":"D"}],"unrated":true}'::jsonb)
on conflict(slug) do nothing;

create or replace view public.maker_tier_aggregates as
select p.id project_id, c.id card_id, c.name,
  count(*) filter(where i.group_key='s')::int s_count,
  count(*) filter(where i.group_key='a')::int a_count,
  count(*) filter(where i.group_key='b')::int b_count,
  count(*) filter(where i.group_key='c')::int c_count,
  count(*) filter(where i.group_key='d')::int d_count,
  count(distinct s.user_id)::int rating_count,
  avg(case i.group_key when 's' then 5 when 'a' then 4 when 'b' then 3 when 'c' then 2 when 'd' then 1 end)::numeric(5,2) average_tier
from public.maker_projects p join public.maker_submissions s on s.project_id=p.id and s.is_valid
join public.maker_submission_items i on i.submission_id=s.id join public.cards c on c.id=i.card_id
group by p.id,c.id,c.name;
revoke all on public.maker_tier_aggregates from anon, authenticated;

create or replace function public.save_maker_submission(
  p_project_id uuid, p_user_id uuid, p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_submission_id uuid;
begin
  insert into maker_submissions(project_id,user_id,is_valid,updated_at)
  values(p_project_id,p_user_id,true,now())
  on conflict(project_id,user_id) do update set is_valid=true,updated_at=now()
  returning id into v_submission_id;
  delete from maker_submission_items where submission_id=v_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position)
  select v_submission_id,x.card_id,x.group_key,x.position
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(card_id uuid,group_key text,position integer)
  join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id
  where x.group_key in ('s','a','b','c','d');
  return v_submission_id;
end $$;
revoke all on function public.save_maker_submission(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_maker_submission(uuid,uuid,jsonb) to service_role;
