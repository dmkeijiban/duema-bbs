'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleMakerPublication } from '@/app/admin/analytics/actions'

type Props = {
  slug: string
  title: string
  status: string
  isPublic: boolean
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: '公開', className: 'bg-green-50 text-green-700' },
  scheduled: { label: '開催前', className: 'bg-blue-50 text-blue-700' },
  ended: { label: '終了', className: 'bg-amber-50 text-amber-700' },
  admin_only: { label: '管理者限定', className: 'bg-purple-50 text-purple-700' },
  draft: { label: '非公開', className: 'bg-gray-100 text-gray-500' },
}

export default function MakerPublishToggle({ slug, title, status, isPublic }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const badge = isPublic
    ? STATUS_BADGE[status] ?? STATUS_BADGE.published
    : status === 'admin_only'
      ? STATUS_BADGE.admin_only
      : STATUS_BADGE.draft

  const handleToggle = () => {
    if (isPending) return
    const makePublic = !isPublic
    if (!makePublic) {
      const ok = window.confirm(
        `「${title}」を非公開にしますか？\n公開ページが見られなくなります。ナビ等の連動する固定ページがある場合、同時に非公開になります。`,
      )
      if (!ok) return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await toggleMakerPublication(slug, makePublic)
      if (result.ok) {
        const pageNote = result.affectedPageTitles.length > 0
          ? `（固定ページ「${result.affectedPageTitles.join('、')}」も${result.isPublic ? '公開' : '非公開'}に）`
          : ''
        setMessage({ type: 'success', text: `${result.isPublic ? '公開' : '非公開'}にしました${pageNote}` })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  if (status === 'admin_only') {
    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_BADGE.admin_only.className}`}>
        {STATUS_BADGE.admin_only.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${badge.className}`}>
          {badge.label}
        </span>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={`rounded border px-2 py-1 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isPublic
              ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
              : 'border-green-300 bg-white text-green-700 hover:bg-green-50'
          }`}
        >
          {isPending ? '保存中…' : isPublic ? '非公開にする' : '公開する'}
        </button>
      </div>
      {message && (
        <p className={`text-[10px] ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
