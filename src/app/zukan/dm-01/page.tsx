import Link from 'next/link'
import { cookies } from 'next/headers'
import { fetchPack, fetchCardsByPack, fetchCardsBySlugs, fetchPackReviews, attachReviewProfiles } from '@/lib/zukan'
import type { ZukanPack, ZukanCard } from '@/lib/zukan'
import { normalizeZukanDisplayName } from '@/lib/zukan-display'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'
import { ZukanReviewAuthor } from '@/components/ZukanReviewAuthor'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import PackShareButtons from './PackShareButtons'
import PackReviewForm from './PackReviewForm'
import AdminPackReviewControls from './AdminPackReviewControls'
import { SITE_URL } from '@/lib/site-config'

export async function generateMetadata() {
  const pack = await fetchPack('dm-01')
  const name = pack?.name ?? MOCK_PACK.name
  const code = pack?.code ?? MOCK_PACK.code
  const description =
    pack?.description ??
    MOCK_PACK.description ??
    'デュエル・マスターズ第1弾「DM-01 基本セット」のカード一覧。ボルシャック・ドラゴンをはじめ、2002年当時の名カードを振り返ろう。'
  const imageUrl = (pack?.image_url ?? MOCK_PACK.image_url) ?? `${SITE_URL}/default-thumbnail.jpg`
  const title = `${code} ${name} | デュエマ思い出図鑑`
  const url = `${SITE_URL}/zukan/dm-01`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website' as const,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${code} ${name} パック画像` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [imageUrl],
    },
  }
}

const PAGE_SIZE = 60

// --- モックフォールバック ---------------------------------------------------

const MOCK_PACK: ZukanPack = {
  id: '',
  slug: 'dm-01',
  code: 'DM-01',
  name: '基本セット',
  released_year: '2002年5月30日',
  card_count: 120,
  description: '2002年5月に発売されたデュエル・マスターズ最初のパック。光・水・闇・火・自然の5文明が揃い、全120種のカードで構成された原点のセット。ボルシャック・ドラゴンやホーリー・スパークなど、当時の対戦を彩った定番カードが数多く収録されている。',
  is_published: true,
  sort_order: 1,
  image_url: null,
}

const MOCK_CARDS: ZukanCard[] = [
  { id: '', pack_id: '', slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', card_type: 'クリーチャー', civilization: '火', cost: 6, mana: 6, race: 'アーマード・ドラゴン', power: '6000+', rarity: 'VR', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 1 },
  { id: '', pack_id: '', slug: 'aqua-hulcus', name: 'アクア・ハルカス', card_type: 'クリーチャー', civilization: '水', cost: 3, mana: 3, race: 'リキッド・ピープル', power: '2000', rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 2 },
  { id: '', pack_id: '', slug: 'gaia-mantis', name: 'ガイア・マンティス', card_type: 'クリーチャー', civilization: '自然', cost: 5, mana: 5, race: 'ビースト・フォーク', power: '5000', rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 3 },
  { id: '', pack_id: '', slug: 'la-ura-giga', name: 'ラ・ウラ・ギガ', card_type: 'クリーチャー', civilization: '光', cost: 1, mana: 1, race: 'スターノイド', power: '2000', rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 4 },
  { id: '', pack_id: '', slug: 'death-smoke', name: 'デス・スモーク', card_type: '呪文', civilization: '闇', cost: 4, mana: 4, race: null, power: null, rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 5 },
  { id: '', pack_id: '', slug: 'twin-cannon', name: 'ツイン・キャノン・ワイバーン', card_type: 'クリーチャー', civilization: '火', cost: 7, mana: 7, race: 'アーマード・ワイバーン', power: '6000', rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 6 },
  { id: '', pack_id: '', slug: 'holy-spark', name: 'ホーリー・スパーク', card_type: '呪文', civilization: '光', cost: 4, mana: 4, race: null, power: null, rarity: 'VR', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 7 },
  { id: '', pack_id: '', slug: 'spiral-gate', name: 'スパイラル・ゲート', card_type: '呪文', civilization: '水', cost: 2, mana: 2, race: null, power: null, rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, official_page_url: null, official_image_url: null, sort_order: 8 },
]

// 代表カード（page=1 のみ表示、DBにあればリンク、なければ準備中）
const REP_CARDS = [
  { slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', civilization: '火' },
  { slug: 'holy-spark',      name: 'ホーリー・スパーク',    civilization: '光' },
  { slug: 'demon-hand',      name: 'デーモン・ハンド',      civilization: '闇' },
  { slug: 'aqua-hulcus',     name: 'アクア・ハルカス',      civilization: '水' },
  { slug: 'natural-trap',    name: 'ナチュラル・トラップ',  civilization: '自然' },
]

// ---------------------------------------------------------------------------

const CIV_BG: Record<string, string> = {
  火: 'from-red-100 to-red-200',
  水: 'from-blue-100 to-blue-200',
  自然: 'from-green-100 to-green-200',
  光: 'from-yellow-50 to-yellow-200',
  闇: 'from-gray-200 to-gray-300',
}

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

const CIV_TEXT: Record<string, string> = {
  火: 'text-red-400',
  水: 'text-blue-400',
  自然: 'text-green-400',
  光: 'text-yellow-500',
  闇: 'text-gray-400',
}

function CardThumb({
  name,
  civilization,
  imageUrl,
}: {
  name: string
  civilization?: string | null
  imageUrl?: string | null
}) {
  if (imageUrl) {
    return (
      <div className="bg-gray-100" style={{ aspectRatio: '63 / 88' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${name} カード画像`}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover"
        />
      </div>
    )
  }

  const bg = civilization ? (CIV_BG[civilization] ?? 'from-gray-100 to-gray-200') : 'from-gray-100 to-gray-200'
  const tc = civilization ? (CIV_TEXT[civilization] ?? 'text-gray-400') : 'text-gray-400'
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br ${bg} text-[9px] font-bold ${tc}`}
      style={{ aspectRatio: '63 / 88' }}
      aria-label={`${name} のカード画像（準備中）`}
    >
      <span className="text-base">{civilization ?? '？'}</span>
      <span className="mt-0.5">画像準備中</span>
    </div>
  )
}

function cardHref(card: ZukanCard): string {
  return card.id ? `/zukan/card/${card.slug}` : '#'
}

function CardListPager({
  page,
  totalPages,
  hasNextPage,
  compact = false,
}: {
  page: number
  totalPages: number | null
  hasNextPage: boolean
  compact?: boolean
}) {
  if (page <= 1 && !hasNextPage) return null

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border border-gray-200 bg-gray-50 px-3 ${compact ? 'py-1.5' : 'py-2'}`}>
      <div>
        {page > 1 ? (
          <Link href={`/zukan/dm-01?page=${page - 1}`} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 cursor-pointer transition-all duration-100 hover:bg-blue-50 hover:border-blue-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            ← 前の60件
          </Link>
        ) : (
          <span className="rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">
            ← 前の60件
          </span>
        )}
      </div>
      {totalPages && (
        <span className="font-mono text-xs text-gray-500">{page} / {totalPages}</span>
      )}
      <div>
        {hasNextPage ? (
          <Link href={`/zukan/dm-01?page=${page + 1}`} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 cursor-pointer transition-all duration-100 hover:bg-blue-50 hover:border-blue-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            次の60件 →
          </Link>
        ) : (
          <span className="rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">
            次の60件 →
          </span>
        )}
      </div>
    </div>
  )
}

export default async function ZukanDm01Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const dbPack = await fetchPack('dm-01')
  const pack = dbPack ?? MOCK_PACK

  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)

  const [dbCards, dbRepCards] = dbPack
    ? await Promise.all([
        fetchCardsByPack(dbPack.id, page),
        page === 1 ? fetchCardsBySlugs(dbPack.id, REP_CARDS.map(r => r.slug)) : Promise.resolve(null),
      ])
    : [null, null]
  const cards = dbCards ?? (page === 1 ? MOCK_CARDS : [])
  const isDbReady = dbPack !== null

  type AdminPackReview = {
    id: number
    user_id: string | null
    display_name: string
    body: string
    created_at: string
    is_hidden: boolean
    avatar_url: string | null
    profile_slug: string | null
    is_withdrawn: boolean
  }

  let packReviews: AdminPackReview[] | null = null
  if (dbPack) {
    if (isAdmin) {
      const { createAdminClient } = await import('@/lib/supabase-admin')
      const adminSupa = createAdminClient()
      const { data } = await adminSupa
        .from('zukan_pack_reviews')
        .select('id, pack_id, user_id, display_name, body, created_at, is_hidden')
        .eq('pack_id', dbPack.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        const enriched = await attachReviewProfiles(data as { id: number; pack_id: string; user_id: string | null; display_name: string; body: string; created_at: string; is_hidden: boolean }[])
        packReviews = enriched.map(r => ({ ...r, is_hidden: r.is_hidden }))
      }
    } else {
      const reviews = await fetchPackReviews(dbPack.id)
      packReviews = reviews ? reviews.map(r => ({ ...r, is_hidden: false as const })) : null
    }
  }

  const total = pack.card_count ?? null
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = (page - 1) * PAGE_SIZE + cards.length
  const hasNextPage = total ? page * PAGE_SIZE < total : cards.length === PAGE_SIZE
  const latestPackReviews = packReviews?.slice(0, 3) ?? []
  const morePackReviews = packReviews?.slice(3) ?? []

  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>{pack.code} {pack.name}</span>
      </nav>

      {!isDbReady && (
        <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          図鑑データを準備中です。現在はサンプル表示です。
        </p>
      )}

      {/* 商品ヘッダー */}
      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[200px_1fr]">
        <div className="mx-auto w-full max-w-[200px]">
          {pack.image_url ? (
            <ZukanImagePreview
              src={pack.image_url}
              alt={`${pack.code} ${pack.name} パック画像`}
              aspectRatio="3 / 4"
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded bg-gradient-to-br from-amber-50 to-orange-100 text-xs text-orange-300 font-bold gap-1"
              style={{ aspectRatio: '3 / 4' }}
              aria-label="DM-01 商品画像（準備中）"
            >
              <span className="text-3xl">🐉</span>
              <span>商品画像準備中</span>
            </div>
          )}
        </div>
        <div className="flex min-h-full flex-col">
          <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
          <h1 className="mt-0.5 text-lg font-bold text-gray-800">{pack.code} {pack.name}</h1>
          <dl className="mt-2 text-sm text-gray-700 space-y-1">
            <div className="flex flex-wrap gap-x-6">
              {pack.released_year && (
                <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>
              )}
              {pack.card_count && (
                <div><dt className="inline font-bold">収録：</dt><dd className="inline">{pack.card_count}種</dd></div>
              )}
            </div>
            <div><dt className="inline font-bold">パック内容：</dt><dd className="inline">5枚入り 150円（税抜）</dd></div>
          </dl>
          <div className="mt-auto pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">このページをシェア</div>
            <PackShareButtons packName={`${pack.code} ${pack.name}`} />
          </div>
        </div>
      </header>

      {/* 代表カード（page=1 のみ） */}
      {page === 1 && (
        <section className="mb-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border border-gray-300 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">{pack.code} {pack.name}の代表カード</h2>
            <Link href="#card-list" className="text-xs text-blue-600 hover:underline">収録カードをもっと見る →</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {REP_CARDS.map(rep => {
              const dbCard = dbRepCards?.find(c => c.slug === rep.slug) ?? null
              const href = dbCard ? `/zukan/card/${rep.slug}` : '#'
              const isLinked = !!dbCard
              const cardClass = `w-[44%] flex-shrink-0 sm:w-auto border border-gray-300 bg-white ${isLinked ? 'block cursor-pointer transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]' : 'opacity-60'}`
              const cardBody = (
                <>
                  <CardThumb
                    name={rep.name}
                    civilization={rep.civilization}
                    imageUrl={dbCard?.official_image_url}
                  />
                  <div className="px-1.5 py-1.5">
                    <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[rep.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
                      {rep.civilization}
                    </span>
                    <div className={`mt-1 truncate text-xs font-bold ${isLinked ? 'text-blue-700' : 'text-gray-800'}`}>
                      {rep.name}
                    </div>
                    {!dbCard && <div className="text-[10px] text-gray-400">詳細準備中</div>}
                  </div>
                </>
              )

              return isLinked ? (
                <Link key={rep.slug} href={href} className={cardClass}>
                  {cardBody}
                </Link>
              ) : (
                <div key={rep.slug} className={cardClass}>
                  {cardBody}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 収録カード */}
      <section id="card-list" className="mb-5">
        <div className="mb-2 flex items-center justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">
            収録カード
            {total && cards.length > 0 && (
              <span className="ml-1 font-normal text-gray-500 text-xs">全{total}種中 {from}〜{to}件目</span>
            )}
          </h2>
          {totalPages && totalPages > 1 && (
            <span className="font-mono text-xs text-gray-500">{page} / {totalPages} ページ</span>
          )}
        </div>
        {cards.length > 0 && (
          <div className="mb-2">
            <CardListPager page={page} totalPages={totalPages} hasNextPage={hasNextPage} compact />
          </div>
        )}
        {cards.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400">このページにはカードがありません。</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {cards.map(card => {
              const isLinked = !!card.id
              const cardClass = `border border-gray-300 bg-white ${isLinked ? 'block cursor-pointer transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]' : ''}`
              const cardBody = (
                <>
                  <CardThumb
                    name={card.name}
                    civilization={card.civilization}
                    imageUrl={card.official_image_url}
                  />
                  <div className="px-1.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {card.civilization && (
                        <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
                          {card.civilization}
                        </span>
                      )}
                      {card.rarity && (
                        <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>
                      )}
                    </div>
                    <div className={`mt-0.5 truncate text-xs font-bold ${isLinked ? 'text-blue-700' : 'text-gray-800'}`}>
                      {card.name}
                    </div>
                    {card.card_type && (
                      <div className="text-[10px] text-gray-400">{card.card_type}</div>
                    )}
                  </div>
                </>
              )

              return isLinked ? (
                <Link key={card.slug} href={cardHref(card)} className={cardClass}>
                  {cardBody}
                </Link>
              ) : (
                <div key={card.slug} className={cardClass}>
                  {cardBody}
                </div>
              )
            })}
          </div>
        )}

        {/* ページネーション */}
        <div className="mt-3">
          <CardListPager page={page} totalPages={totalPages} hasNextPage={hasNextPage} />
        </div>
      </section>

      {/* このパックの思い出 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">このパックの思い出</h2>
        </div>
        {packReviews && packReviews.length > 0 && (
          <div className="mb-3 divide-y divide-gray-100 border border-gray-200 bg-white">
            {latestPackReviews.map(r => (
              <article key={r.id} className={`px-3 py-2.5 ${r.is_hidden ? 'opacity-50 bg-gray-50' : ''}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <ZukanReviewAuthor
                    displayName={normalizeZukanDisplayName(r.display_name)}
                    avatarUrl={r.avatar_url}
                    profileSlug={r.profile_slug}
                    isWithdrawn={r.is_withdrawn}
                  />
                  <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</time>
                  {r.is_hidden && <span className="text-red-500 font-bold">[非表示]</span>}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                {isAdmin && (
                  <AdminPackReviewControls
                    reviewId={r.id}
                    packId={pack.id}
                    initialBody={r.body}
                    isHidden={r.is_hidden}
                  />
                )}
              </article>
            ))}
            {morePackReviews.length > 0 && (
              <details className="border-t border-gray-100">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-blue-600 transition-colors duration-100 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400">
                  もっと見る
                </summary>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {morePackReviews.map(r => (
                    <article key={r.id} className={`px-3 py-2.5 ${r.is_hidden ? 'opacity-50 bg-gray-50' : ''}`}>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <ZukanReviewAuthor
                          displayName={normalizeZukanDisplayName(r.display_name)}
                          avatarUrl={r.avatar_url}
                          profileSlug={r.profile_slug}
                          isWithdrawn={r.is_withdrawn}
                        />
                        <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</time>
                        {r.is_hidden && <span className="text-red-500 font-bold">[非表示]</span>}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                      {isAdmin && (
                        <AdminPackReviewControls
                          reviewId={r.id}
                          packId={pack.id}
                          initialBody={r.body}
                          isHidden={r.is_hidden}
                        />
                      )}
                    </article>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
        {packReviews !== null && packReviews.length === 0 && (
          <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">まだ投稿はありません。最初の思い出を書いてみませんか？</p>
        )}
        {isDbReady && pack.id && <PackReviewForm packId={pack.id} />}
        {!isDbReady && <p className="border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">DBが準備中のため投稿できません</p>}
      </section>
    </div>
  )
}
