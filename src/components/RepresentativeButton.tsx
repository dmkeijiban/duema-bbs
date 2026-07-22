'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setContentRepresentative } from '@/app/actions/content-representative'
import type { RepresentativeContentType } from '@/lib/user-content-representatives'

export function RepresentativeButton({ contentType, contentId, selected }: { contentType: RepresentativeContentType; contentId: string; selected: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (selected) return <span className="inline-flex min-h-10 items-center rounded-lg bg-amber-50 px-3 text-sm font-bold text-amber-800">★ 代表に設定中</span>
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => {
    const result = await setContentRepresentative(contentType, contentId)
    if (!result.ok) alert(result.message)
    else router.refresh()
  })} className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 px-3 text-sm font-bold text-amber-800 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
    {pending ? '設定中…' : '代表に設定'}
  </button>
}
