begin;

-- 正式タイトルを「私を象徴するデュエマカード9選」に統一する（2026-07-20の一時的な差し戻しを再修正）
update public.maker_projects
set
  title = '私を象徴するデュエマカード9選',
  config = jsonb_set(
    coalesce(config, '{}'::jsonb),
    '{resultTitle}',
    to_jsonb('私を象徴するデュエマカード9選'::text),
    true
  ),
  updated_at = now()
where slug = 'my-duema-9';

-- TOP注目企画バナー（site_settings.top_featured_campaign）の title も同じ表記へ揃える
update public.site_settings
set
  value = jsonb_set(
    value::jsonb,
    '{title}',
    to_jsonb('私を象徴するデュエマカード9選'::text),
    true
  )::text,
  updated_at = now()
where key = 'top_featured_campaign';

commit;
