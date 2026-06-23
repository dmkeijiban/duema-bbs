'use client'

import { deleteCampaignEventAction } from './actions'

export function DeleteEventButton({ id, title }: { id: number; title: string }) {
  return (
    <form
      action={deleteCampaignEventAction}
      onSubmit={(e) => {
        if (!confirm(`「${title}」を削除しますか？\nこの操作は元に戻せません。`)) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={String(id)} />
      <button
        type="submit"
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        削除
      </button>
    </form>
  )
}
