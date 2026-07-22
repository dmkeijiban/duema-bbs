begin;

create table if not exists public.deck_submission_cards (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.deck_submissions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  printing_id uuid references public.card_printings(id) on delete restrict,
  face_side_index integer not null default 0 check (face_side_index >= 0),
  sort_order integer not null check (sort_order >= 0),
  zone text not null default 'main' check (char_length(zone) between 1 and 40),
  quantity integer not null check (quantity between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, zone, sort_order)
);

create index if not exists deck_submission_cards_submission_zone_idx
  on public.deck_submission_cards(submission_id, zone, sort_order);
create index if not exists deck_submission_cards_card_idx
  on public.deck_submission_cards(card_id);
create index if not exists deck_submission_cards_printing_idx
  on public.deck_submission_cards(printing_id)
  where printing_id is not null;

alter table public.deck_submission_cards enable row level security;
revoke all on table public.deck_submission_cards from anon, authenticated;
grant all on table public.deck_submission_cards to service_role;

comment on table public.deck_submission_cards is 'デッキ保存JSONと同一トランザクションで同期する検索・集計用カード明細';
comment on column public.deck_submission_cards.zone is 'mainを初期値とし、将来のgr・超次元・特殊ゾーン等を追加可能なゾーン識別子';
comment on column public.deck_submission_cards.face_side_index is '選択時に表示していたカード面。0が表面';
comment on column public.deck_submission_cards.sort_order is 'ゾーン内の表示順';

create or replace function public.sync_deck_submission_cards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.deck_submission_cards where submission_id = new.id;

  insert into public.deck_submission_cards (
    submission_id,
    card_id,
    printing_id,
    face_side_index,
    sort_order,
    zone,
    quantity
  )
  select
    new.id,
    (entry.value ->> 'id')::uuid,
    coalesce(
      nullif(entry.value ->> 'printingId', '')::uuid,
      printing.id
    ),
    greatest(coalesce(nullif(entry.value ->> 'faceSideIndex', '')::integer, 0), 0),
    entry.ordinality::integer - 1,
    coalesce(nullif(entry.value ->> 'zone', ''), 'main'),
    (entry.value ->> 'count')::integer
  from jsonb_array_elements(new.deck_data) with ordinality as entry(value, ordinality)
  left join public.card_printings printing
    on printing.source_key = nullif(entry.value ->> 'sourceKey', '')
   and printing.card_id = (entry.value ->> 'id')::uuid;

  return new;
end;
$$;

revoke all on function public.sync_deck_submission_cards() from public, anon, authenticated;
grant execute on function public.sync_deck_submission_cards() to service_role;

drop trigger if exists sync_deck_submission_cards_after_write on public.deck_submissions;
create trigger sync_deck_submission_cards_after_write
after insert or update of deck_data on public.deck_submissions
for each row execute function public.sync_deck_submission_cards();

insert into public.deck_submission_cards (
  submission_id,
  card_id,
  printing_id,
  face_side_index,
  sort_order,
  zone,
  quantity
)
select
  submission.id,
  (entry.value ->> 'id')::uuid,
  coalesce(
    nullif(entry.value ->> 'printingId', '')::uuid,
    printing.id
  ),
  greatest(coalesce(nullif(entry.value ->> 'faceSideIndex', '')::integer, 0), 0),
  entry.ordinality::integer - 1,
  coalesce(nullif(entry.value ->> 'zone', ''), 'main'),
  (entry.value ->> 'count')::integer
from public.deck_submissions submission
cross join lateral jsonb_array_elements(submission.deck_data) with ordinality as entry(value, ordinality)
left join public.card_printings printing
  on printing.source_key = nullif(entry.value ->> 'sourceKey', '')
 and printing.card_id = (entry.value ->> 'id')::uuid
on conflict (submission_id, zone, sort_order) do update set
  card_id = excluded.card_id,
  printing_id = excluded.printing_id,
  face_side_index = excluded.face_side_index,
  quantity = excluded.quantity,
  updated_at = now();

commit;
