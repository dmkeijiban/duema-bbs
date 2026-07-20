begin;

-- 旧カリスマBEST専用トップPOPを汎用「TOP注目企画」枠へ移行する
update public.site_settings
set value = 'featured_campaign', updated_at = now()
where key = 'top_showcase_mode' and value = 'tier_maker';

insert into public.site_settings (key, value, label, updated_at)
values (
  'top_featured_campaign',
  '{"enabled":true,"projectSlug":"my-duema-9","label":"人気企画","subText":"みんなで作るデュエマ企画","title":"あなたを象徴するデュエマカード9選","description":"自分を象徴するカードを9枚選んで、3×3の画像を作ろう。画像保存・X共有もできます。","mainButtonLabel":"9選を作る","mainButtonLink":"/makers/my-duema-9","subButtonLabel":"みんなの9選を見る","subButtonLink":"/makers/my-duema-9/submissions","imageUrl":""}',
  'TOP注目企画',
  now()
)
on conflict (key) do update set value = excluded.value, label = excluded.label, updated_at = now();

insert into public.site_settings (key, value, label, updated_at)
values (
  'top_green_banner_buttons',
  '[{"enabled":true,"label":"アカウント作成","href":"/login?mode=signup","icon":"","openInNewTab":false,"emphasis":false,"order":0},{"enabled":true,"label":"デュエマあそびば","href":"/makers","icon":"","openInNewTab":false,"emphasis":false,"order":1},{"enabled":true,"label":"新しいお知らせ","href":"/mypage","icon":"🔔","openInNewTab":false,"emphasis":false,"order":2}]',
  'TOP緑帯ボタン',
  now()
)
on conflict (key) do update set value = excluded.value, label = excluded.label, updated_at = now();

commit;
