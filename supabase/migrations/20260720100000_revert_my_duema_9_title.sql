begin;

-- 正式タイトルを「あなたを象徴するデュエマカード9選」に統一する
update public.maker_projects
set
  title = 'あなたを象徴するデュエマカード9選',
  config = jsonb_set(
    config,
    '{resultTitle}',
    to_jsonb('あなたを象徴するデュエマカード9選'::text),
    true
  ),
  updated_at = now()
where slug = 'my-duema-9';

commit;
