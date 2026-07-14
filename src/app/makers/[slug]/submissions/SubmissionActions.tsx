'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMakerSubmission } from './actions'

export default function SubmissionActions({ slug, submissionId, canEdit }: { slug: string; submissionId: string; canEdit: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (!canEdit) return null
  return <div className="mt-3 flex gap-2">
    <button type="button" onClick={() => router.push(`/makers/${slug}/submissions/${submissionId}/edit`)} className="rounded border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-700">編集</button>
    <button type="button" disabled={pending} onClick={() => { if (!confirm('このTier表を削除しますか？この操作は取り消せません。')) return; startTransition(async () => { const result = await deleteMakerSubmission(slug, submissionId); if (result.ok) router.push(`/makers/${slug}/submissions`); else alert(result.message) }) }} className="rounded border border-red-600 px-3 py-1.5 text-sm font-bold text-red-700 disabled:opacity-50">{pending ? '削除中...' : '削除'}</button>
  </div>
}
