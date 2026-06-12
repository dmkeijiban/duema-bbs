'use client'

import { useActionState } from 'react'
import { addRelatedThread, removeRelatedThread, type AdminActionState } from '../actions'

const INITIAL: AdminActionState = { status: 'idle' }

type LinkedThread = {
  id: number
  thread_id: string
  thread_title: string | null
  sort_order: number
}

export default function RelatedThreadForm({
  cardId,
  links,
}: {
  cardId: string
  links: LinkedThread[]
}) {
  const addAction = addRelatedThread.bind(null)
  const [addState, addDispatch, addPending] = useActionState(addAction, INITIAL)

  return (
    <div className="space-y-3">
      {/* Existing links */}
      {links.length > 0 && (
        <ul className="divide-y rounded border border-gray-200 bg-white">
          {links.map(link => (
            <li key={link.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <span className="block truncate text-xs font-bold text-blue-700">
                  {link.thread_title ?? `スレッド #${link.thread_id}`}
                </span>
                <span className="text-[10px] text-gray-400">ID: {link.thread_id}</span>
              </div>
              <RemoveButton linkId={link.id} cardId={cardId} />
            </li>
          ))}
        </ul>
      )}
      {links.length === 0 && (
        <p className="text-xs text-gray-500">関連スレッドはまだ登録されていません。</p>
      )}

      {/* Add form */}
      {links.length < 5 && (
        <form action={addDispatch} className="flex flex-col gap-1.5">
          <input type="hidden" name="card_id" value={cardId} />
          <div className="flex gap-2">
            <input
              type="text"
              name="thread_id"
              placeholder="スレッドIDを入力"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={addPending}
              className="whitespace-nowrap rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addPending ? '追加中...' : '追加'}
            </button>
          </div>
          {addState.status !== 'idle' && (
            <span className={`text-[10px] ${addState.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
              {addState.message}
            </span>
          )}
        </form>
      )}
      {links.length >= 5 && (
        <p className="text-[10px] text-gray-500">最大5件に達しています。追加するには既存のリンクを削除してください。</p>
      )}
    </div>
  )
}

function RemoveButton({ linkId, cardId }: { linkId: number; cardId: string }) {
  const removeAction = removeRelatedThread.bind(null)
  const [, dispatch, isPending] = useActionState(removeAction, INITIAL)

  return (
    <form action={dispatch}>
      <input type="hidden" name="link_id" value={linkId} />
      <input type="hidden" name="card_id" value={cardId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? '...' : '削除'}
      </button>
    </form>
  )
}
