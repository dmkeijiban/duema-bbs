'use client'
import { useTransition, useState } from 'react'
import { adminHidePackReview, adminUnhidePackReview, adminEditPackReview } from './actions'

export default function AdminPackReviewControls({
  reviewId,
  packId,
  initialBody,
  isHidden,
}: {
  reviewId: number
  packId: string
  initialBody: string
  isHidden: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(initialBody)

  const toggle = () => {
    startTransition(async () => {
      if (isHidden) await adminUnhidePackReview(reviewId, packId)
      else await adminHidePackReview(reviewId, packId)
    })
  }

  const saveEdit = () => {
    startTransition(async () => {
      await adminEditPackReview(reviewId, packId, editBody)
      setEditing(false)
    })
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-dashed border-red-100 pt-1">
      <span className="text-[10px] font-bold text-red-500">管理</span>
      <button
        onClick={toggle}
        disabled={pending}
        className="text-[10px] text-gray-500 underline hover:text-red-600 disabled:opacity-50"
      >
        {isHidden ? '再表示' : '非表示'}
      </button>
      <button
        onClick={() => setEditing(v => !v)}
        disabled={pending}
        className="text-[10px] text-gray-500 underline hover:text-blue-600 disabled:opacity-50"
      >
        編集
      </button>
      {isHidden && <span className="text-[10px] font-bold text-orange-500">［非表示中］</span>}
      {editing && (
        <div className="mt-1 w-full">
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="mt-1 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={pending}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            >
              保存
            </button>
            <button
              onClick={() => { setEditing(false); setEditBody(initialBody) }}
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
