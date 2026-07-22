begin;

-- A logical card owns its deck placement. Printings and faces inherit this value,
-- so deck validation never has to guess from a display name.
alter table public.cards
  add column if not exists deck_zone_class text not null default 'normal',
  add column if not exists deck_zone_class_needs_review boolean not null default false,
  add column if not exists deck_zone_class_reason text;

alter table public.cards
  drop constraint if exists cards_deck_zone_class_check;

alter table public.cards
  add constraint cards_deck_zone_class_check
  check (deck_zone_class in ('normal', 'gr', 'hyperspatial', 'special'));

create index if not exists cards_active_deck_zone_class_idx
  on public.cards (deck_zone_class, id)
  where is_active = true;

create or replace function public.deck_zone_class_from_card_type(p_card_type text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when coalesce(p_card_type, '') ~* '(^|[^[:alnum:]])(NEO[[:space:]]+)?GRクリーチャー' then 'gr'
    when coalesce(p_card_type, '') ~ '(サイキック|ドラグハート)' then 'hyperspatial'
    when coalesce(p_card_type, '') ~ '(禁断の鼓動|禁断クリーチャー|禁断フィールド|最終禁断|零龍クリーチャー|零龍星雲|零龍の儀)' then 'special'
    else 'normal'
  end
$$;

create or replace function public.refresh_card_deck_zone_class(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card_type text;
  v_classes text[];
  v_has_type boolean;
  v_class text;
  v_needs_review boolean;
  v_reason text;
begin
  select c.card_type
    into v_card_type
    from public.cards c
   where c.id = p_card_id;

  if not found then
    return;
  end if;

  select
    coalesce(array_agg(distinct x.zone_class order by x.zone_class)
      filter (where x.zone_class <> 'normal'), '{}'::text[]),
    bool_or(nullif(btrim(x.card_type), '') is not null)
    into v_classes, v_has_type
    from (
      select v_card_type as card_type,
             public.deck_zone_class_from_card_type(v_card_type) as zone_class
      union all
      select f.card_type,
             public.deck_zone_class_from_card_type(f.card_type)
        from public.card_faces f
       where f.card_id = p_card_id
    ) x;

  v_class := case
    when 'special' = any(v_classes) then 'special'
    when 'gr' = any(v_classes) then 'gr'
    when 'hyperspatial' = any(v_classes) then 'hyperspatial'
    else 'normal'
  end;
  v_needs_review := coalesce(cardinality(v_classes) > 1, false) or not coalesce(v_has_type, false);
  v_reason := case
    when cardinality(v_classes) > 1 then 'conflicting_structured_types:' || array_to_string(v_classes, ',')
    when not coalesce(v_has_type, false) then 'missing_structured_type'
    else 'structured_card_type'
  end;

  update public.cards
     set deck_zone_class = v_class,
         deck_zone_class_needs_review = v_needs_review,
         deck_zone_class_reason = v_reason
   where id = p_card_id
     and (deck_zone_class, deck_zone_class_needs_review, coalesce(deck_zone_class_reason, ''))
         is distinct from (v_class, v_needs_review, coalesce(v_reason, ''));
end
$$;

create or replace function public.refresh_card_deck_zone_class_from_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.deck_zone_class := public.deck_zone_class_from_card_type(new.card_type);
  new.deck_zone_class_needs_review := nullif(btrim(new.card_type), '') is null;
  new.deck_zone_class_reason := case
    when new.deck_zone_class_needs_review then 'missing_structured_type'
    else 'structured_card_type'
  end;
  return new;
end
$$;

create or replace function public.refresh_card_deck_zone_class_from_face()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_card_deck_zone_class(coalesce(new.card_id, old.card_id));
  if tg_op = 'UPDATE' and old.card_id is distinct from new.card_id then
    perform public.refresh_card_deck_zone_class(old.card_id);
  end if;
  return coalesce(new, old);
end
$$;

drop trigger if exists cards_refresh_deck_zone_class on public.cards;
create trigger cards_refresh_deck_zone_class
before insert or update of card_type on public.cards
for each row execute function public.refresh_card_deck_zone_class_from_card();

drop trigger if exists card_faces_refresh_deck_zone_class on public.card_faces;
create trigger card_faces_refresh_deck_zone_class
after insert or update of card_id, card_type or delete on public.card_faces
for each row execute function public.refresh_card_deck_zone_class_from_face();

do $$
declare
  v_card_id uuid;
begin
  for v_card_id in select id from public.cards loop
    perform public.refresh_card_deck_zone_class(v_card_id);
  end loop;
end
$$;

revoke all on function public.deck_zone_class_from_card_type(text) from public, anon, authenticated;
revoke all on function public.refresh_card_deck_zone_class(uuid) from public, anon, authenticated;
revoke all on function public.refresh_card_deck_zone_class_from_card() from public, anon, authenticated;
revoke all on function public.refresh_card_deck_zone_class_from_face() from public, anon, authenticated;
grant execute on function public.deck_zone_class_from_card_type(text) to service_role;
grant execute on function public.refresh_card_deck_zone_class(uuid) to service_role;

comment on column public.cards.deck_zone_class is
  'Validated deck placement: normal, gr, hyperspatial, or special.';
comment on column public.cards.deck_zone_class_needs_review is
  'True when structured card metadata is missing or gives conflicting placement classes.';
comment on column public.cards.deck_zone_class_reason is
  'Machine-readable classification source or review reason; never inferred from card name.';

commit;
