import Link from 'next/link'
import { formatJapanDateTime } from '@/lib/date-time'

export type PublicDeckCardData = {
  id: string
  title: string
  user_id: string | null
  created_at: string
  key_card_id?: string | null
  deck_data: Array<{ id: string; name: string; imageUrl: string | null; sourceKey: string | null; count: number }>
}

export function PublicDeckCard({ deck, authorName }: { deck: PublicDeckCardData; authorName: string }) {
  const keyCard = deck.deck_data.find(card => card.id === deck.key_card_id) ?? deck.deck_data[0]
  const uniqueCards = deck.deck_data.length
  const totalCards = deck.deck_data.reduce((sum, card) => sum + card.count, 0)

  return (
    <Link href={`/makers/deck-maker/submissions/${deck.id}`} className="group grid grid-cols-[112px_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:scale-[0.99] sm:grid-cols-[138px_1fr]">
      <div className="relative min-h-40 bg-slate-800 sm:min-h-48">
        {keyCard?.imageUrl
          ? <img src={keyCard.imageUrl} alt={`${deck.title}の代表カード ${keyCard.name}`} className="h-full w-full object-cover object-top" loading="lazy" />
          : <span className="flex h-full items-center justify-center p-3 text-center text-xs font-bold text-white">{keyCard?.name ?? 'カード画像なし'}</span>}
      </div>
      <div className="flex min-w-0 flex-col p-4">
        <p className="text-[11px] font-bold text-blue-700">オリジナル</p>
        <h2 className="mt-1 line-clamp-2 text-lg font-black leading-snug text-slate-950 group-hover:text-blue-800">{deck.title}</h2>
        <p className="mt-2 line-clamp-1 text-xs text-slate-500">{keyCard ? `${keyCard.name} ほか${Math.max(uniqueCards - 1, 0)}種` : 'カード情報なし'}</p>
        <div className="mt-auto pt-4 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-2"><span className="truncate">{authorName}</span><span>{totalCards}枚</span></div>
          <time className="mt-1 block">{formatJapanDateTime(deck.created_at)}</time>
        </div>
      </div>
    </Link>
  )
}
