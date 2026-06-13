import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardBySlug, fetchCardReviews, fetchCardRatings } from '@/lib/zukan'
import type { ZukanCardWithPack } from '@/lib/zukan'
import { normalizeZukanDisplayName } from '@/lib/zukan-display'
import { ZukanReviewAuthor } from '@/components/ZukanReviewAuthor'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ShareButtons from './ShareButtons'
import CardReviewForm from './CardReviewForm'
import CardRatingForm from './CardRatingForm'

const MOCK_CARD: ZukanCardWithPack = {
  id: '',
  pack_id: '',
  slug: 'bolshack-dragon',
  name: 'ボルシャック・ドラゴン',
  card_type: 'クリーチャー',
  civilization: '火',
  cost: 6,
  mana: 6,
  race: 'アーマード・ドラゴン',
  power: '6000+',
  rarity: 'ベリーレア',
  illustrator: null,
  ability_text: 'パワーアタッカー＋1000。W・ブレイカー。このクリーチャーが攻撃する時、自分の墓地にある火のカード1枚につき、このクリーチャーのパワーはそのターン＋1000される。',
  flavor_text: null,
  image_url: null,
  official_page_url: null,
  official_image_url: null,
  sort_order: 1,
  zukan_packs: { slug: 'dm-01', code: 'DM-01', name: '基本セット' },
}

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

const RATING_LABELS = [
  ['当時の憧れ度', 'admiration'],
  ['使われた時のトラウマ度', 'trauma'],
  ['今見ても好き度', 'stillLike'],
  ['名前のかっこよさ', 'name'],
  ['イラストのかっこよさ', 'art'],
] as const

function CardThumb({ name }: { name: string }) {
  return (
    <div
      className="flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-[10px] text-gray-400"
      style={{ aspectRatio: '63 / 88' }}
      aria-label={`${name} のカード画像（準備中）`}
    >
      カード画像準備中
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await fetchCardBySlug(slug)
  const name =
    result.status === 'found'
      ? result.card.name
      : slug === 'bolshack-dragon'
        ? 'ボルシャック・ドラゴン'
        : slug
  return {
    title: `${name} | デュエマ思い出図鑑`,
  }
}

export default async function ZukanCardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await fetchCardBySlug(slug)

  let card: ZukanCardWithPack
  let isDbReady = false

  if (result.status === 'found') {
    card = result.card
    isDbReady = true
  } else if (result.status === 'not_found') {
    notFound()
  } else {
    if (slug !== 'bolshack-dragon') notFound()
    card = MOCK_CARD
  }

  const [cardReviews, ratingsSummary] = isDbReady
    ? await Promise.all([
        fetchCardReviews(card.id),
        fetchCardRatings(card.id),
      ])
    : [null, null]

  const pack = card.zukan_packs
  const packHref = pack ? `/zukan/${pack.slug}` : '/zukan'
  const packLabel = pack ? `${pack.code} ${pack.name}` : '図鑑トップ'
  const ratingCount = ratingsSummary?.totalCount ?? 0
  const reviewCount = cardReviews?.length ?? 0

  return (
    <div className="mx-auto max-w-[1080px] px-2 pt-2 pb-10">
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1 flex-wrap">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <Link href={packHref} className="text-blue-600 hover:underline">{packLabel}</Link>
        <span>{'>'}</span>
        <span>{card.name}</span>
      </nav>

      {!isDbReady && (
        <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          図鑑データを準備中です。現在はサンプル表示です。
        </p>
      )}

      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[170px_1fr]">
        <div className="mx-auto w-full max-w-[200px] md:max-w-[170px]">
          {card.official_image_url ? (
            <ZukanImagePreview
              src={card.official_image_url}
              alt={`${card.name} カード画像`}
              imageClassName="w-full"
            />
          ) : (
            <CardThumb name={card.name} />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            {card.civilization && (
              <span className={`inline-block rounded px-1.5 text-xs font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
                {card.civilization}
              </span>
            )}
            {card.rarity && (
              <span className="font-mono text-xs text-gray-400">{card.rarity}</span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-800">{card.name}</h1>
          {pack && (
            <div className="mt-1 text-xs text-gray-500">
              収録：<Link href={packHref} className="text-blue-600 hover:underline">{packLabel}</Link>
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
            {card.card_type && <div><dt className="font-bold text-gray-500">種別</dt><dd>{card.card_type}</dd></div>}
            {card.civilization && <div><dt className="font-bold text-gray-500">文明</dt><dd>{card.civilization}</dd></div>}
            {card.cost !== null && <div><dt className="font-bold text-gray-500">コスト</dt><dd className="font-mono">{card.cost}</dd></div>}
            {card.mana !== null && <div><dt className="font-bold text-gray-500">マナ</dt><dd className="font-mono">{card.mana}</dd></div>}
            {card.race && <div><dt className="font-bold text-gray-500">種族</dt><dd>{card.race}</dd></div>}
            {card.power && <div><dt className="font-bold text-gray-500">パワー</dt><dd className="font-mono">{card.power}</dd></div>}
            {card.rarity && <div><dt className="font-bold text-gray-500">レアリティ</dt><dd>{card.rarity}</dd></div>}
            {card.illustrator && <div><dt className="font-bold text-gray-500">イラスト</dt><dd>{card.illustrator}</dd></div>}
          </dl>
          {card.ability_text && (
            <p className="mt-3 text-xs leading-relaxed text-gray-700 border-l-2 border-gray-200 pl-2">
              {card.ability_text}
            </p>
          )}
          {card.flavor_text && (
            <p className="mt-2 text-xs leading-relaxed text-gray-400 italic border-l-2 border-gray-100 pl-2">
              {card.flavor_text}
            </p>
          )}
          {card.official_page_url && (
            <div className="mt-3">
              <a
                href={card.official_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                公式カード詳細 →
              </a>
            </div>
          )}
          <div className="mt-4 border-t border-gray-100 pt-3">
            <h2 className="mb-2 text-xs font-bold text-gray-700">このカードを共有</h2>
            <ShareButtons cardName={card.name} />
          </div>
        </div>
      </header>

      <section className="mb-5 border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
          <h2 className="text-base font-bold text-gray-800">みんなの思い出</h2>
        </div>
        <div className="space-y-5 p-3">
          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-800">
              みんなの思い出評価{ratingCount > 0 ? `（${ratingCount}件）` : ''}
            </h3>
            {ratingsSummary ? (
              <div className="mb-3 border border-gray-200 bg-white divide-y divide-gray-100">
                {RATING_LABELS.map(([label, key]) => {
                  const stat = ratingsSummary[key]
                  const pct = stat.avg ? Math.round((stat.avg / 5) * 100) : 0
                  return (
                    <div key={label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[11rem_1fr_3rem]">
                      <span className="text-xs font-bold text-gray-700">{label}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        {pct > 0 && <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />}
                      </div>
                      <span className="text-right font-mono text-xs text-gray-600">
                        {stat.avg ? stat.avg.toFixed(1) : '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
                まだ評価はありません
              </p>
            )}
            {isDbReady && <CardRatingForm cardId={card.id} slug={slug} />}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-800">
              このカードの思い出レビュー（{reviewCount}件）
            </h3>
            {cardReviews && cardReviews.length > 0 && (
              <div className="mb-3 divide-y divide-gray-100 border border-gray-200 bg-white">
                {cardReviews.map(r => (
                  <article key={r.id} className="px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <ZukanReviewAuthor
                        displayName={normalizeZukanDisplayName(r.display_name)}
                        avatarUrl={r.avatar_url}
                        profileSlug={r.profile_slug}
                      />
                      <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</time>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                  </article>
                ))}
              </div>
            )}
            {cardReviews !== null && cardReviews.length === 0 && (
              <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
                まだ投稿はありません。最初の思い出を書いてみませんか？
              </p>
            )}
            {isDbReady && <CardReviewForm cardId={card.id} slug={slug} />}
          </section>
        </div>
      </section>
    </div>
  )
}
