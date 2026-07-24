begin;

-- Refines deck_zone_class_from_card_type():
-- - hyperspatial now also covers rule-plus cards (ルール・プラス), which occupy the
--   super-dimension zone under current official rules exactly like psychic cards.
-- - special is narrowed from a broad forbidden/zeron-family regex down to only the
--   two card types that are legitimately selectable as the single "special slot"
--   card (最終禁断フィールド / 零龍クリーチャー). Every other forbidden/zeron-family
--   card type (禁断クリーチャー, 禁断の鼓動, 禁断フィールド, 零龍の儀, 零龍星雲,
--   キング・セル, etc.) is a normal deck card that goes in the main deck, not the
--   special slot — confirmed by reverse-engineering an equivalent product's deck
--   editor (see docs/research/dmhub-advance-investigation.md in the research
--   branch: those card types were observed landing in the main zone, while only a
--   curated two-item radio selection populated the special slot).
create or replace function public.deck_zone_class_from_card_type(p_card_type text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when coalesce(p_card_type, '') ~* '(^|[^[:alnum:]])(NEO[[:space:]]+)?GRクリーチャー' then 'gr'
    when coalesce(p_card_type, '') ~ '(サイキック|ドラグハート|ルール・プラス)' then 'hyperspatial'
    when coalesce(p_card_type, '') in ('最終禁断フィールド', '零龍クリーチャー') then 'special'
    else 'normal'
  end
$$;

-- Re-run the same backfill the original migration used, now with the refined function.
do $$
declare
  v_card_id uuid;
begin
  for v_card_id in select id from public.cards loop
    perform public.refresh_card_deck_zone_class(v_card_id);
  end loop;
end
$$;

commit;
