'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CreatedContentSection } from '@/components/CreatedContentSection'
import type { ResumeData } from '@/lib/maker-resume'
import type { PublicSubmission } from '@/lib/maker-submissions'
import type { PublicDeckCardData } from '@/components/deck/PublicDeckCard'

type CreatedContent = {
  nine: { representative: PublicSubmission | null; count: number }
  deck: { representative: PublicDeckCardData | null; items: PublicDeckCardData[]; count: number }
}

export function PublicProfileCreatedContent({
  data,
  avatarUrl,
  resumeDate,
  isPublic,
}: {
  data: ResumeData
  avatarUrl: string | null
  resumeDate: string
  isPublic: boolean
}) {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[1] ?? ''
  const [createdContent, setCreatedContent] = useState<CreatedContent | null>(null)

  useEffect(() => {
    if (!slug) return

    const controller = new AbortController()
    void fetch(`/api/public-profile-created-content/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() as Promise<CreatedContent> : Promise.reject(new Error('Failed to load created content')))
      .then(setCreatedContent)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error(error)
      })

    return () => controller.abort()
  }, [slug])

  if (!createdContent) {
    return (
      <section className="mt-4 rounded border border-gray-200 bg-white p-4">
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </section>
    )
  }

  return (
    <div className="mt-4">
      <CreatedContentSection
        resume={{ data, isPublic, updatedAt: resumeDate }}
        avatarUrl={avatarUrl}
        resumeUpdatedAtLabel=""
        nine={createdContent.nine}
        deck={createdContent.deck}
      />
    </div>
  )
}
