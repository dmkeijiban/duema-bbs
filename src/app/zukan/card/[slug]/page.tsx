import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardBySlug, fetchCardReviews, fetchCardRatings, fetchRelatedThreads } from '@/lib/zukan'
import type { ZukanCardWithPack } from '@/lib/zukan'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ShareButtons from './ShareButtons'
import CardReviewForm from './CardReviewForm'
import CardRatingForm from './CardRatingForm'

// --- モックフォールバック（bolshack-dragon 専用） ---------------------------

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

// ---------------------------------------------------------------------------

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

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
    // table_missing or error: fallback to mock for bolshack-dragon only
    if (slug !== 'bolshack-dragon') notFound()
    card = MOCK_CARD
  }

  const cardReviews = isDbReady ? await fetchCardReviews(card.id) : null
  const ratingsSummary = isDbReady ? await fetchCardRatings(card.id) : null
  const relatedThreads = await fetchRelatedThreads(card.name)

  const pack = card.zukan_packs
  const packHref = pack ? `/zukan/${pack.slug}` : '/zukan'
  const packLabel = pack ? `${pack.code} ${pack.name}` : '図鑑トップ'

  return (
    <div className="max-w-4xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
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

      {/* カードヘッダー */}
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
          {/* シェアボタン */}
          <div className="mt-3">
            <ShareButtons cardName={card.name} />
          </div>
        </div>
      </header>

      {/* 5項目評価 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">みんなの思い出評価</h2>
        </div>
        {ratingsSummary ? (
          <div className="mb-3 border border-gray-300 bg-white divide-y divide-gray-100">
            {(
              [
                ['当時の憧れ度', ratingsSummary.admiration],
                ['使われた時のトラウマ度', ratingsSummary.trauma],
                ['今見ても好き度', ratingsSummary.stillLike],
                ['名前のかっこよさ', ratingsSummary.name],
                ['イラストのかっこよさ', ratingsSummary.art],
              ] as const
            ).map(([label, stat]) => {
              const pct = stat.avg ? Math.round((stat.avg / 5) * 100) : 0
              return (
                <div key={label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[11rem_1fr_3rem]">
                  <span className="text-xs font-bold text-gray-700">{label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    {pct > 0 && <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />}
                  </div>
                  <span className="text-right font-mono text-xs text-gray-600">
                    {stat.avg ? stat.avg.toFixed(1) : '—'}
                    {stat.count > 0 && <span className="text-gray-400 text-[10px] ml-0.5">({stat.count})</span>}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">まだ評価はありません</p>
        )}
        {isDbReady && <CardRatingForm cardId={card.id} slug={slug} />}
      </section>

      {/* ひとことメモ */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">ひとことメモ</h2>
        </div>
        <p className="border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">まだありません</p>
      </section>

      {/* レビュー */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">思い出レビュー</h2>
        </div>
        {cardReviews && cardReviews.length > 0 && (
          <div className="mb-3 divide-y divide-gray-100 border border-gray-200 bg-white">
            {cardReviews.map(r => (
              <div key={r.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <span className="font-bold text-gray-700">{r.display_name}</span>
                  <span>{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
              </div>
            ))}
          </div>
        )}
        {cardReviews !== null && cardReviews.length === 0 && (
          <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">まだ投稿はありません。最初の思い出を書いてみませんか？</p>
        )}
        {isDbReady && <CardReviewForm cardId={card.id} slug={slug} />}
      </section>

      {/* 関連スレッド */}
      <section className="mb-2">
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">関連スレッド</h2>
          </div>
          {relatedThreads.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {relatedThreads.map(t => (
                <li key={t.id}>
                  <Link href={`/threads/${t.id}`} className="block px-3 py-2.5 text-xs text-blue-600 hover:underline hover:bg-blue-50">
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-xs text-gray-400">まだ関連スレッドはありません</p>
          )}
        </div>
      </section>
    </div>
  )
}
