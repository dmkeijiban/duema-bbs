'use client'
import { useEffect } from 'react'
import { recordMakerEvent } from '@/lib/maker-events'
import type { MakerEventType } from '@/lib/maker-events-shared'
export default function SubmissionsViewEvent({ slug, eventType }: { slug: string; eventType: MakerEventType }) {
  useEffect(() => { void recordMakerEvent({ slug, eventType }).catch(() => {}) }, [eventType, slug])
  return null
}
