-- DM26-EX2 Tier表へメインSPR 5種だけを冪等追加する。
-- 既存カード、既存企画カード、submissionは更新・削除しない。
do $$
declare
  v_project_id uuid;
  v_added_count integer;
begin
  select id into v_project_id
  from public.maker_projects
  where slug = 'dm26-ex2-charisma-best-tier';

  if v_project_id is null then
    raise exception 'DM26_EX2_TIER_PROJECT_NOT_FOUND';
  end if;

  insert into public.cards (id, name, normalized_name, image_url, civilization, cost, card_type, regulation, is_active)
  values
    ('26e20000-0000-4000-8000-000000000001', '瀑水神 ミヅハノオオミカミ', '瀑水神ミヅハノオオミカミ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/001.jpg', '{}', null, null, 'none', true),
    ('26e20000-0000-4000-8000-000000000002', '世界竜皇 ボルシャック・ヒカリスマ', '世界竜皇ボルシャック・ヒカリスマ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/002.jpg', '{}', null, null, 'none', true),
    ('26e20000-0000-4000-8000-000000000003', '邪眼魔凰デス・フェニックス', '邪眼魔凰デス・フェニックス', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/003.jpg', '{}', null, null, 'none', true),
    ('26e20000-0000-4000-8000-000000000004', 'SSS級侵略 カリスマゾーン', 'SSS級侵略カリスマゾーン', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/004.jpg', '{}', null, null, 'none', true),
    ('26e20000-0000-4000-8000-000000000005', 'CRY-S-MAX ジャオウガ', 'CRY-S-MAXジャオウガ', 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/005.jpg', '{}', null, null, 'none', true)
  on conflict (normalized_name) do nothing;

  insert into public.maker_project_cards (project_id, card_id, sort_order)
  select v_project_id, c.id, spr.sort_order
  from (values
    ('瀑水神ミヅハノオオミカミ', -4),
    ('世界竜皇ボルシャック・ヒカリスマ', -3),
    ('邪眼魔凰デス・フェニックス', -2),
    ('SSS級侵略カリスマゾーン', -1),
    ('CRY-S-MAXジャオウガ', 0)
  ) as spr(normalized_name, sort_order)
  join public.cards c on c.normalized_name = spr.normalized_name
  on conflict (project_id, card_id) do nothing;

  select count(*) into v_added_count
  from public.maker_project_cards pc
  join public.cards c on c.id = pc.card_id
  where pc.project_id = v_project_id
    and c.normalized_name in (
      '瀑水神ミヅハノオオミカミ', '世界竜皇ボルシャック・ヒカリスマ',
      '邪眼魔凰デス・フェニックス', 'SSS級侵略カリスマゾーン', 'CRY-S-MAXジャオウガ'
    );

  if v_added_count <> 5 then
    raise exception 'DM26_EX2_SPR_COUNT_MISMATCH: %', v_added_count;
  end if;
end $$;
