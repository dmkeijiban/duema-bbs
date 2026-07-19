-- カリスマBEST再投入で「公式収録版へ移行済みの旧プレビュー行」が復活する問題への対処。
-- 20260718090000 の移行はプレビュー行を公式source_keyへリネームし、旧キーを
-- card_printing_source_aliases(old_source_key -> official_source_key) に記録済み。
-- その後にプレビューシードが再実行されると、旧キーの行が新規UUIDで復活し、
-- 同じカードに「同じ絵・別URL」の収録版が二重に見える。
-- 対処: aliasに旧キーとして記録されている source_key の行だけを非表示化する。
-- 画像URLでの推測は行わないため、別イラスト・別加工・両面カードには一切影響しない。
begin;

update public.card_printings p
set is_search_visible = false,
    source_status = 'superseded',
    updated_at = now()
from public.card_printing_source_aliases a
where p.source_key = a.old_source_key
  and (p.is_search_visible = true or p.source_status <> 'superseded');

commit;
