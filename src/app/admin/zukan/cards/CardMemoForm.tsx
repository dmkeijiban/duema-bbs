'use client'

import { useActionState } from 'react'
import { saveCardMemo, type AdminActionState } from '../actions'

const INITIAL: AdminActionState = { status: 'idle' }

export default function CardMemoForm({
  cardId,
  defaultBody,
}: {
  cardId: string
  defaultBody: string
}) {
  const action = saveCardMemo.bind(null)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)

  return (
    <form action={dispatch} className="flex flex-col gap-1.5">
      <input type="hidden" name="card_id" value={cardId} />
      <textarea
        name="body"
        defaultValue={defaultBody}
        rows={3}
        maxLength={200}
        placeholder="カードのひとことメモ（最大200文字）"
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs leading-5 focus:border-blue-400 focus:outline-none resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
        {state.status !== 'idle' && (
          <span className={`text-[10px] ${state.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
