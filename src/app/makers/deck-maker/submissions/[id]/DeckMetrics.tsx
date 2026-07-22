'use client'

import { useEffect } from 'react'

export default function DeckMetrics({ id }: { id: string }) {
  useEffect(() => {
    fetch(`/api/makers/deck-submissions/${id}/view`, { method: 'POST' }).catch(() => {})
  }, [id])

  return null
}
