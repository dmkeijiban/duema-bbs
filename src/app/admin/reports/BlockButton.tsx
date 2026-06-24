'use client'

import { useTransition } from 'react'
import { blockReportSourceAction } from './actions'

export function BlockButton({ reportId }: { reportId: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('この送信元からの通報受付を止めますか？')) return
        const formData = new FormData()
        formData.set('reportId', String(reportId))
        formData.set('reason', `report:${reportId}`)
        startTransition(async () => {
          await blockReportSourceAction(formData)
        })
      }}
      className="rounded border border-red-300 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? '設定中...' : '受付停止'}
    </button>
  )
}
