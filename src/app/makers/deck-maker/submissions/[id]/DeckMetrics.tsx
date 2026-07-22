'use client'

import { useEffect, useState } from 'react'

export default function DeckMetrics({ id, initialViews, copies }: { id: string; initialViews: number; copies: number }) {
  const [views, setViews] = useState(initialViews)

  useEffect(() => {
    fetch(`/api/makers/deck-submissions/${id}/view`, { method: 'POST' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (typeof data?.viewCount === 'number') setViews(data.viewCount) })
      .catch(() => {})
  }, [id])

  return <><span>閲覧 {views}</span><span>コピー {copies}</span></>
}
