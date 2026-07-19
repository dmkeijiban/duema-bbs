begin;

update public.maker_projects
set
  title = '私を象徴するデュエマカード9選',
  config = jsonb_set(
    config,
    '{resultTitle}',
    to_jsonb('私を象徴するデュエマカード9選'::text),
    true
  ),
  updated_at = now()
where slug = 'my-duema-9';

commit;
