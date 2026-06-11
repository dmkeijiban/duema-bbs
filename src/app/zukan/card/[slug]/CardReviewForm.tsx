'use client'

import { useActionState } from 'react'
import { submitCardReview, type CardReviewFormState } from './actions'

const INITIAL: CardReviewFormState = { status: 'idle' }

export default function CardReviewForm({ cardId, slug }: { cardId: string; slug: string }) {
  const action = submitCardReview.bind(null, cardId, slug)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)

  if (state.status === 'success') {
    return (
      <p className="border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
        投稿しました！ありがとうございます。
      </p>
    )
  }

  return (
    <form action={dispatch} className="border border-gray-200 bg-white p-3">
      <div className="mb-2">
        <label className="block text-xs font-bold text-gray-600 mb-1" htmlFor="card-display-name">
          名前（省略可）
        </label>
        <input
          id="card-display-name"
          name="display_name"
          type="text"
          maxLength={50}
          placeholder="名無しさん"
          className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="mb-2">
        <label className="block text-xs font-bold text-gray-600 mb-1" htmlFor="card-body">
          思い出・感想 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="card-body"
          name="body"
          required
          maxLength={500}
          rows={4}
          placeholder="このカードにまつわる思い出、対戦での記憶など..."
          className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none resize-none"
        />
        <p className="text-right text-[10px] text-gray-400">最大500文字</p>
      </div>
      {state.status === 'error' && (
        <p className="mb-2 text-xs text-red-600">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? '送信中...' : '投稿する'}
      </button>
    </form>
  )
}
