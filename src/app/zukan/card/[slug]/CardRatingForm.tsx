'use client'

import { useActionState } from 'react'
import { submitCardRating, type CardRatingFormState } from './actions'

const INITIAL: CardRatingFormState = { status: 'idle' }

const ITEMS = [
  { key: 'score_admiration', label: '当時の憧れ度' },
  { key: 'score_trauma',     label: '使われた時のトラウマ度' },
  { key: 'score_still_like', label: '今見ても好き度' },
  { key: 'score_name',       label: '名前のかっこよさ' },
  { key: 'score_art',        label: 'イラストのかっこよさ' },
] as const

function StarRow({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="w-40 shrink-0 text-xs font-bold text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(v => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} className="sr-only peer" />
            <span className="text-xl text-gray-300 peer-checked:text-yellow-400 hover:text-yellow-300 select-none">
              ★
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function CardRatingForm({ cardId, slug }: { cardId: string; slug: string }) {
  const action = submitCardRating.bind(null, cardId, slug)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)

  if (state.status === 'success') {
    return (
      <p className="border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
        評価を送信しました！ありがとうございます。
      </p>
    )
  }

  return (
    <form action={dispatch} className="border border-gray-200 bg-white px-3 py-2">
      {ITEMS.map(item => (
        <StarRow key={item.key} name={item.key} label={item.label} />
      ))}
      {state.status === 'error' && (
        <p className="mt-2 text-xs text-red-600">{state.message}</p>
      )}
      <div className="mt-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '送信中...' : '評価を送信する'}
        </button>
      </div>
    </form>
  )
}
