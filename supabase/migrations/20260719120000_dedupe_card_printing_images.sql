-- カリスマBEST再投入で発生した「同一カード内で全く同じ画像を指す収録版が複数存在する」
-- 状態を解消する。source_key はグローバルに unique なので行自体は重複しないが、
-- 同じ card_id に対して image_url が完全一致する複数行が誤って作られることがある。
-- 実カードとして別に存在する収録版（画像が異なる）は一切変更しない。
begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by card_id, image_url
      order by is_representative desc, (source_status = 'official') desc, created_at asc, id asc
    ) as rank_in_group
  from public.card_printings
  where image_url is not null
),
duplicates as (
  select id from ranked where rank_in_group > 1
)
update public.card_printings p
set is_search_visible = false, updated_at = now()
from duplicates d
where p.id = d.id and p.is_search_visible = true;

commit;
