'use client'

import { useActionState } from 'react'
import { toggleZukanHidden, type AdminActionState } from './actions'

const INITIAL: AdminActionState = { status: 'idle' }

export default function HideToggleButton({
  type,
  id,
  isHidden,
}: {
  type: 'pack_review' | 'card_review' | 'rating'
  id: number
  isHidden: boolean
}) {
  const action = toggleZukanHidden.bind(null)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)

  const nextHidden = !isHidden

  return (
    <form action={dispatch} className="flex flex-col items-start gap-1">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hidden" value={String(nextHidden)} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded border px-2 py-1 text-xs font-bold transition-colors
          ${isHidden
            ? 'border-green-300 bg-white text-green-700 hover:bg-green-50 active:bg-green-100'
            : 'border-red-300 bg-white text-red-700 hover:bg-red-50 active:bg-red-100'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
      >
        {isPending ? '処理中...' : isHidden ? '再表示' : '非表示'}
      </button>
      {state.status !== 'idle' && (
        <span className={`text-[10px] ${state.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {state.message}
        </span>
      )}
    </form>
  )
}
