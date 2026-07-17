#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const matches = JSON.parse(await readFile('data/cards/dm26-ex2-preview-official-matches.json', 'utf8'))
const official = JSON.parse(await readFile('data/cards/dm26-ex2-official.json', 'utf8'))
const byKey = new Map(official.map((row) => [row.source_key, row]))
const q = (value) => value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const normalizeName = (value) => value.normalize('NFKC').trim().replace(/[\s\u3000]+/g, '').replace(/[／∕]/g, '/').replace(/[・·]/g, '・')
const matched = matches.filter((row) => row.status === 'matched')
const officialOnly = matches.filter((row) => row.status === 'official_only')
if (matched.length !== 149 || officialOnly.length !== 5) throw new Error('照合件数が想定外です')
const values = matched.map((match) => {
  const row = byKey.get(match.officialSourceKey)
  return `  (${q(match.previewSourceKey)},${q(row.source_key)},${q(row.name)},${q(normalizeName(row.name))},${q(row.official_page_url)},${q(row.image_url)},${q(row.set_name)},${q(row.card_number)})`
}).join(',\n')
const extraValues = officialOnly.map((match) => {
  const row = byKey.get(match.officialSourceKey)
  return `  (${q(row.source_key)},${q(row.name)},${q(normalizeName(row.name))},${q(row.official_page_url)},${q(row.image_url)},${q(row.set_name)},${q(row.card_number)})`
}).join(',\n')
const sql = `-- Generated from official DM26-EX2 cache and reviewed 149:149 match JSON.
-- Additive/rollback-friendly: printing/card UUIDs are preserved and old source keys remain resolvable.
begin;

alter table public.card_printings add column if not exists is_search_visible boolean not null default true;
alter table public.card_printings add column if not exists source_status text not null default 'official'
  check (source_status in ('preview','official','superseded'));

create table if not exists public.card_printing_source_aliases (
  old_source_key text primary key,
  printing_id uuid not null references public.card_printings(id) on delete restrict,
  official_source_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists card_printing_source_aliases_printing_idx on public.card_printing_source_aliases(printing_id);
alter table public.card_printing_source_aliases enable row level security;
comment on table public.card_printing_source_aliases is '保存済みデッキ等の旧収録版source_keyを正式収録版へ解決する';

create temporary table dm26_ex2_match(
  preview_source_key text primary key, official_source_key text unique not null, official_name text not null, official_normalized_name text not null,
  official_page_url text not null, image_url text not null, set_name text, card_number text
) on commit drop;
insert into dm26_ex2_match values
${values};

do $$ begin
  if (select count(*) from dm26_ex2_match) <> 149 then raise exception 'DM26-EX2 match count mismatch'; end if;
  if exists(select 1 from dm26_ex2_match m where (select count(*) from public.card_printings p where p.source_key in (m.preview_source_key,m.official_source_key)) <> 1) then raise exception 'DM26-EX2 source identity is not exactly one row'; end if;
end $$;

insert into public.card_printing_source_aliases(old_source_key,printing_id,official_source_key)
select m.preview_source_key,p.id,m.official_source_key from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
on conflict(old_source_key) do update set printing_id=excluded.printing_id,official_source_key=excluded.official_source_key;

do $$ begin
  if exists(
    select 1 from (
      select distinct p.card_id,m.official_normalized_name
      from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
    ) x join public.cards other on other.normalized_name=x.official_normalized_name and other.id<>x.card_id
  ) then raise exception 'DM26-EX2 normalized_name collision'; end if;
end $$;

with official_cards as (
  select distinct on (p.card_id) p.card_id,m.official_name,m.official_normalized_name
  from dm26_ex2_match m join public.card_printings p on p.source_key in (m.preview_source_key,m.official_source_key)
  order by p.card_id,m.official_source_key
)
update public.cards c set name=x.official_name,normalized_name=x.official_normalized_name
from official_cards x where c.id=x.card_id and (c.name is distinct from x.official_name or c.normalized_name is distinct from x.official_normalized_name);

update public.card_printings p set
  source_key=m.official_source_key, official_page_url=m.official_page_url, image_url=m.image_url,
  set_name=m.set_name, card_number=m.card_number, is_search_visible=true, source_status='official', updated_at=now()
from dm26_ex2_match m where p.source_key=m.preview_source_key;

create temporary table dm26_ex2_official_only(
  source_key text primary key, official_name text not null, normalized_name text not null, official_page_url text not null,
  image_url text not null, set_name text, card_number text
) on commit drop;
insert into dm26_ex2_official_only values
${extraValues};

insert into public.card_printings(card_id,source_key,official_page_url,image_url,set_name,card_number,is_representative,is_search_visible,source_status)
select c.id,x.source_key,x.official_page_url,x.image_url,x.set_name,x.card_number,false,true,'official'
from dm26_ex2_official_only x
join public.cards c on c.normalized_name = x.normalized_name
on conflict(source_key) do update set official_page_url=excluded.official_page_url,image_url=excluded.image_url,set_name=excluded.set_name,card_number=excluded.card_number,is_search_visible=true,source_status='official',updated_at=now();

do $$ begin
  if (select count(*) from public.card_printings where source_key like 'DM26EX2-PREVIEW-%') <> 0 then raise exception 'preview keys remain'; end if;
  if (select count(*) from public.card_printings where source_key like 'dm26ex2-%') <> 154 then raise exception 'official printing count mismatch'; end if;
  if (select count(*) from public.card_printing_source_aliases where old_source_key like 'DM26EX2-PREVIEW-%') <> 149 then raise exception 'alias count mismatch'; end if;
end $$;

commit;
`
await writeFile('supabase/migrations/20260718090000_migrate_dm26_ex2_preview_to_official.sql', sql)
console.log(JSON.stringify({ matched: matched.length, officialOnly: officialOnly.length, output: 'supabase/migrations/20260718090000_migrate_dm26_ex2_preview_to_official.sql' }, null, 2))
