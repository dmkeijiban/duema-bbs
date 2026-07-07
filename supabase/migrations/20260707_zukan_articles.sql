create table if not exists public.zukan_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  article_type text not null check (article_type in ('pack_article', 'hall_of_fame_article')),
  target_id text not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  blocks jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zukan_articles_target_status_idx
  on public.zukan_articles (article_type, target_id, status);

create index if not exists zukan_articles_updated_at_idx
  on public.zukan_articles (updated_at desc);

create unique index if not exists zukan_articles_slug_idx
  on public.zukan_articles (slug);

create unique index if not exists zukan_articles_one_published_per_target_idx
  on public.zukan_articles (article_type, target_id)
  where status = 'published';

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zukan_articles_updated_at on public.zukan_articles;
create trigger zukan_articles_updated_at
  before update on public.zukan_articles
  for each row execute function public.update_updated_at_column();

alter table public.zukan_articles enable row level security;

drop policy if exists "Public can read published zukan articles" on public.zukan_articles;
create policy "Public can read published zukan articles"
  on public.zukan_articles
  for select
  using (status = 'published');

insert into public.zukan_articles (
  slug,
  article_type,
  target_id,
  title,
  description,
  status,
  blocks,
  published_at
)
select
  'dm-01',
  'pack_article',
  'dm-01',
  'DM-01 基本セットはなぜ「原点」なのか',
  '2002年の最初の基本セットを、当時の遊び方と代表カードから振り返る読み物です。',
  'published',
  $json$[
    {
      "type": "paragraph",
      "text": "DM-01 基本セットは、デュエル・マスターズのカードプールがまだ120種だけだった時代の入口です。今見ると能力は素朴ですが、文明ごとの役割、シールド・トリガーの怖さ、切り札を出すまでの駆け引きは、この時点ですでに揃っていました。"
    },
    {
      "type": "packHero",
      "caption": "最初の基本セット。光・水・闇・火・自然の5文明がここから始まりました。"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "切り札は重く、だからこそ強く見えた"
    },
    {
      "type": "paragraph",
      "text": "初期の対戦では、6マナ以上の大型クリーチャーを出すだけでも大きな事件でした。ボルシャック・ドラゴンのようなカードは、単に強いだけでなく「ここまでゲームを進めたごほうび」として記憶に残りやすい存在でした。"
    },
    {
      "type": "card",
      "slug": "bolshack-dragon",
      "caption": "火文明の象徴として長く語られる、初期デュエマの顔。"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "勝負をひっくり返すトリガーの記憶"
    },
    {
      "type": "paragraph",
      "text": "DM-01の面白さは、大型クリーチャーだけではありません。攻め切れると思った瞬間にホーリー・スパークやデーモン・ハンドを踏む体験が、デュエマらしい逆転の緊張感を作っていました。"
    },
    {
      "type": "cardGrid",
      "title": "当時の対戦で印象に残りやすいカード",
      "slugs": [
        "holy-spark",
        "demon-hand",
        "aqua-hulcus",
        "natural-trap",
        "spiral-gate",
        "twin-cannon"
      ],
      "caption": "記事内カードグリッドはスマホ2列、PCでは3〜4列で表示します。"
    },
    {
      "type": "note",
      "text": "この記事は運営者作成コンテンツです。ユーザー投稿の思い出欄とは別に、パックの読み物として今後も追加できます。"
    },
    {
      "type": "relatedLinks",
      "title": "あわせて見る",
      "links": [
        { "label": "DM-01の収録カード一覧へ", "href": "#card-list" },
        { "label": "思い出図鑑トップへ", "href": "/zukan" }
      ]
    }
  ]$json$::jsonb,
  now()
where not exists (
  select 1
  from public.zukan_articles
  where article_type = 'pack_article'
    and target_id = 'dm-01'
    and status = 'published'
);

notify pgrst, 'reload schema';
