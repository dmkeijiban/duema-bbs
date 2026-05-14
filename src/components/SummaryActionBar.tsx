'use client'

import { useEffect, useState } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  slug: string
  title: string
}

const X_SHARE_SUFFIX = '#デュエマ'

export function SummaryActionBar({ slug, title }: Props) {
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    setFavorited(localStorage.getItem(`summary-favorite:${slug}`) === '1')
  }, [slug])

  const toggleFavorite = () => {
    const next = !favorited
    setFavorited(next)
    if (next) localStorage.setItem(`summary-favorite:${slug}`, '1')
    else localStorage.removeItem(`summary-favorite:${slug}`)
    capturePostHogEvent('summary_favorite_toggle', { slug, favorited: next })
  }

  const shareX = () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = `${title.trim()} ${url} ${X_SHARE_SUFFIX}`
    capturePostHogEvent('summary_x_share_click', { slug, title })
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer,width=600,height=400')
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleFavorite}
        className="text-xl leading-none w-8 h-8 flex items-center justify-center"
        style={{ color: favorited ? '#f5a623' : '#aaa' }}
        title={favorited ? 'お気に入りを解除' : 'お気に入りに追加'}
      >
        {favorited ? '★' : '☆'}
      </button>
      <button
        type="button"
        onClick={shareX}
        className="text-white text-sm font-bold w-8 h-8 flex items-center justify-center rounded"
        style={{ background: '#000' }}
        title="Xで共有"
      >
        X
      </button>
    </div>
  )
}
