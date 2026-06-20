'use client'
import { useTransition, useState } from 'react'
import { adminHideReview, adminUnhideReview, adminEditReview } from './actions'

export default function AdminReviewControls({
  reviewId,
  slug,
  initialBody,
  isHidden,
}: {
  reviewId: number
  slug: string
  initialBody: string
  isHidden: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(initialBody)

  const toggle = () => {
    startTransition(async () => {
      if (isHidden) await adminUnhideReview(reviewId, slug)
      else await adminHideReview(reviewId, slug)
    })
  }

  const saveEdit = () => {
    startTransition(async () => {
      await adminEditReview(reviewId, slug, editBody)
      setEditing(false)
    })
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-dashed border-red-100 pt-1">
      <button
        onClick={toggle}
        disabled={pending || isHidden}
        className="text-[10px] text-red-600 underline hover:text-red-800 disabled:opacity-50"
      >
        削除
      </button>
      <button
        onClick={() => setEditing(v => !v)}
        disabled={pending}
        className="text-[10px] text-gray-500 underline hover:text-blue-600 disabled:opacity-50"
      >
        編集
      </button>
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
