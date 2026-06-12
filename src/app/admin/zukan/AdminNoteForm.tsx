'use client'

import { useActionState } from 'react'
import { saveAdminNote, type AdminActionState } from './actions'

const INITIAL: AdminActionState = { status: 'idle' }

export default function AdminNoteForm({
  postType,
  postId,
  defaultNote,
}: {
  postType: 'pack_review' | 'card_review' | 'rating'
  postId: number
  defaultNote: string
}) {
  const action = saveAdminNote.bind(null)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)

  return (
    <form action={dispatch} className="mt-2 flex flex-col gap-1">
      <input type="hidden" name="post_type" value={postType} />
      <input type="hidden" name="post_id" value={postId} />
      <input
        type="text"
        name="note"
        defaultValue={defaultNote}
        placeholder="管理メモ（荒らし/重複/不適切/テスト等）"
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
        maxLength={200}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPending ? '保存中...' : 'メモ保存'}
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
