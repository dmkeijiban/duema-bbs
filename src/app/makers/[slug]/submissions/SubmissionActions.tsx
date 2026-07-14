'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMakerSubmission } from './actions'
import { anonymousSubmissionOwnerKey } from '@/lib/maker-anonymous-owner'
import { useAnonymousSubmissionOwnerToken } from '@/lib/use-anonymous-submission-owner'

export default function SubmissionActions({ slug, submissionId, canEdit, anonymousOwner = false }: { slug: string; submissionId: string; canEdit: boolean; anonymousOwner?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const ownerToken = useAnonymousSubmissionOwnerToken(slug, submissionId, anonymousOwner)
  if (!canEdit && !ownerToken) return null
  return <div className="mt-3 flex gap-2">
    <button type="button" onClick={() => router.push(`/makers/${slug}/submissions/${submissionId}/edit`)} className="rounded border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-700">編集</button>
    <button type="button" disabled={pending} onClick={() => { if (!confirm('このTier表を削除しますか？この操作は取り消せません。')) return; startTransition(async () => { const result = await deleteMakerSubmission(slug, submissionId, ownerToken); if (result.ok) { localStorage.removeItem(anonymousSubmissionOwnerKey(slug, submissionId)); router.push(`/makers/${slug}/submissions`) } else alert(result.message) }) }} className="rounded border border-red-600 px-3 py-1.5 text-sm font-bold text-red-700 disabled:opacity-50">{pending ? '削除中...' : '削除'}</button>
  </div>
}
