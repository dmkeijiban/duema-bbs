'use client'

import { useActionState, useState } from 'react'
import { submitCardRating, type CardRatingFormState } from './actions'

const INITIAL: CardRatingFormState = { status: 'idle' }

const ITEMS = [
  { key: 'score_admiration', label: '当時の憧れ度' },
  { key: 'score_trauma',     label: '使われた時のトラウマ度' },
  { key: 'score_still_like', label: '今見ても好き度' },
  { key: 'score_name',       label: '名前のかっこよさ' },
  { key: 'score_art',        label: 'イラストのかっこよさ' },
] as const

export type ItemKey = (typeof ITEMS)[number]['key']

function StarRow({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-gray-100 last:border-0">
      <span className="w-36 shrink-0 text-xs font-bold text-gray-700">{label}</span>
      <div
        className="flex gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            type="button"
            aria-label={`${label} ${v}点`}
            onMouseEnter={() => setHover(v)}
            onClick={() => onChange(v)}
            onTouchEnd={(e) => { e.preventDefault(); onChange(v) }}
            className={`text-2xl leading-none select-none transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
              v <= display ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-10">
        {value !== null ? `${value} / 5` : ''}
      </span>
      {/* Hidden input for Server Action FormData */}
      {value !== null && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  )
}

export default function CardRatingForm({ cardId, slug, initialValues }: { cardId: string; slug: string; initialValues?: Partial<Record<ItemKey, number>> }) {
  const action = submitCardRating.bind(null, cardId, slug)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)
  const [values, setValues] = useState<Partial<Record<ItemKey, number>>>(initialValues ?? {})

  const setValue = (key: ItemKey, v: number) => {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  const allSelected = ITEMS.every(item => values[item.key] !== undefined)

  return (
    <form action={dispatch} className="border border-gray-200 bg-white px-3 py-2">
      {ITEMS.map(item => (
        <StarRow
          key={item.key}
          name={item.key}
          label={item.label}
          value={values[item.key] ?? null}
          onChange={(v) => setValue(item.key, v)}
        />
      ))}
      {state.status === 'error' && (
        <p className="mt-2 text-xs text-red-600">{state.message}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !allSelected}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white transition-all duration-100 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPending ? '送信中…' : initialValues ? '評価を変更する' : '評価を送信する'}
        </button>
        {!allSelected && (
          <span className="text-xs text-gray-400">全項目を選択してください</span>
        )}
      </div>
    </form>
  )
}
