begin;

-- Aggregate view backing the deck maker's "採用枚数順" (usage-count) sort. Counts
-- copies of each card across public deck submissions using the already-synced
-- deck_submission_cards mirror table (kept current by sync_deck_submission_cards()).
-- A plain view (not materialized) is used deliberately: deck_submission_cards is
-- indexed on card_id and the dataset is small enough that on-demand aggregation is
-- fine for now. If this becomes a hot path, revisit as a materialized view with a
-- scheduled refresh.
create or replace view public.card_usage_counts as
select
  dsc.card_id,
  sum(dsc.quantity)::integer as usage_count
from public.deck_submission_cards dsc
join public.deck_submissions ds on ds.id = dsc.submission_id
where ds.is_public = true
group by dsc.card_id;

comment on view public.card_usage_counts is
  '公開デッキ全体でのカードごとの採用枚数合計（デッキメーカーの採用枚数順ソート用）';

grant select on public.card_usage_counts to service_role;

commit;
