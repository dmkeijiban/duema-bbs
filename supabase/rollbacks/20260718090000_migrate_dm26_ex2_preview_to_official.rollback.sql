-- Non-destructive emergency rollback for 20260718090000.
-- Keeps all UUIDs and aliases; the five official-only SPR secret rows are hidden, never deleted.
begin;

create temp table dm26_ex2_card_merge on commit drop as
select old_card_id,canonical_card_id from public.card_logical_aliases where reason='dm26-ex2-preview-official-migration';

update public.maker_project_cards x set card_id=m.old_card_id from dm26_ex2_card_merge m where x.card_id=m.canonical_card_id;
update public.maker_submission_items x set card_id=m.old_card_id from dm26_ex2_card_merge m where x.card_id=m.canonical_card_id;
do $$ begin
  if to_regclass('public.zukan_cards') is not null then
    execute 'update public.zukan_cards x set card_id=m.old_card_id from dm26_ex2_card_merge m where x.card_id=m.canonical_card_id';
  end if;
end $$;
update public.card_printings x set card_id=m.old_card_id from dm26_ex2_card_merge m
where x.card_id=m.canonical_card_id and (x.source_key like 'dm26ex2-%' or x.source_key like 'DM26EX2-PREVIEW-%');
update public.cards x set is_active=true from dm26_ex2_card_merge m where x.id=m.old_card_id;

update public.card_printings p
set source_key=a.old_source_key,
    official_page_url='https://dm.takaratomy.co.jp/product/dm26ex2/',
    image_url='https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/' || right(a.old_source_key,3) || '.jpg',
    set_name='DM26-EX2 悪感謝祭 カリスマBEST',
    is_search_visible=true,
    source_status='preview',
    updated_at=now()
from public.card_printing_source_aliases a
where p.id=a.printing_id
  and a.old_source_key like 'DM26EX2-PREVIEW-%'
  and p.source_key=a.official_source_key;

update public.card_printing_source_aliases
set official_source_key=old_source_key
where old_source_key like 'DM26EX2-PREVIEW-%';

update public.card_printings
set is_search_visible=false,source_status='superseded',updated_at=now()
where source_key in (
  'dm26ex2-SPRSEC001','dm26ex2-SPRSEC002','dm26ex2-SPRSEC003','dm26ex2-SPRSEC004','dm26ex2-SPRSEC005'
);

do $$ begin
  if (select count(*) from public.card_printings where source_key like 'DM26EX2-PREVIEW-%') <> 149 then raise exception 'rollback preview count mismatch'; end if;
  if (select count(*) from public.card_printing_source_aliases where old_source_key like 'DM26EX2-PREVIEW-%') <> 149 then raise exception 'rollback alias count mismatch'; end if;
end $$;

commit;
