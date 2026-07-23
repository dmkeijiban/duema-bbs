begin;

insert into public.maker_projects (
  slug,
  title,
  type,
  status,
  is_public,
  config
)
select
  'childhood-trump-card-9',
  '子どもの頃のデッキの切り札9選',
  source.type,
  'published',
  true,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                coalesce(source.config, '{}'::jsonb),
                '{description}',
                to_jsonb('子どもの頃に使っていたデッキの切り札や、思い出に残っているエースカードを9枚選ぼう。'::text),
                true
              ),
              '{resultTitle}',
              to_jsonb('子どもの頃のデッキの切り札9選'::text),
              true
            ),
            '{defaultTitle}',
            to_jsonb('子どもの頃のデッキの切り札9選'::text),
            true
          ),
          '{shareText}',
          to_jsonb('子どもの頃のデッキの切り札9選を作りました！'::text),
          true
        ),
        '{hashtag}',
        to_jsonb('#子どもの頃の切り札9選'::text),
        true
      ),
      '{submissionsLabel}',
      to_jsonb('みんなの切り札9選を見る'::text),
      true
    ),
    '{catalog}',
    coalesce(source.config->'catalog', '{}'::jsonb) || jsonb_build_object(
      'showInCatalog', true,
      'featured', false,
      'category', 'play',
      'sortOrder', 21,
      'isNew', true,
      'shortDescription', '子どもの頃に使っていたデッキの切り札を9枚選べます。'
    ),
    true
  )
from public.maker_projects source
where source.slug = 'my-duema-9'
on conflict (slug) do update set
  title = excluded.title,
  type = excluded.type,
  status = excluded.status,
  is_public = excluded.is_public,
  config = excluded.config,
  updated_at = now();

commit;
