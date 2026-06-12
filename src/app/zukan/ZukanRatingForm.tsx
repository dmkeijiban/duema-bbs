'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { submitCardRating, type ZukanActionState } from './actions'

type ZukanRatingFormProps = {
  cardId: string
  cardSlug: string
}

const initialState: ZukanActionState = { ok: false }

const RATING_FIELDS = [
  ['nostalgia_score', '当時の思い出度'],
  ['play_score', '使った・使われた印象'],
  ['now_score', '今見ても好き度'],
  ['name_score', '名前のかっこよさ'],
  ['illustration_score', 'イラストのかっこよさ'],
] as const

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? '保存中...' : '評価する'}
    </button>
  )
}

export default function ZukanRatingForm({
  cardId,
  cardSlug,
}: ZukanRatingFormProps) {
  const [state, formAction] = useActionState(submitCardRating, initialState)

  return (
    <form action={formAction} className="space-y-3 rounded border bg-white p-4">
      <input type="hidden" name="card_id" value={cardId} />
      <input type="hidden" name="card_slug" value={cardSlug} />

      <div className="grid gap-3 sm:grid-cols-2">
        {RATING_FIELDS.map(([name, label]) => (
          <label key={name} className="block text-sm font-bold text-slate-700">
            <span className="mb-1 block">{label}</span>
            <select
              name={name}
              required
              defaultValue="5"
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold text-slate-600">
          名前（未入力なら匿名）
        </label>
        <input
          name="author_name"
          maxLength={30}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="匿名"
        />
        <p className="mt-1 text-xs text-slate-500">
          同じカードへの評価は、同じユーザーまたは同じ匿名セッションでは更新扱いになります。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.message && (
          <p className="text-sm font-bold text-green-700">{state.message}</p>
        )}
        {state.error && (
          <p className="text-sm font-bold text-red-700">{state.error}</p>
        )}
      </div>
    </form>
  )
}
