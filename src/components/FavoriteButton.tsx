'use client'

import { useState, useTransition } from 'react'
import { toggleFavorite } from '@/app/actions/thread'

interface Props {
  threadId: number
  initialFavorited: boolean
}

export function FavoriteButton({ threadId, initialFavorited }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleFavorite(threadId)
      setFavorited(result.favorited)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-2xl leading-none disabled:opacity-50 transition-colors"
      style={{ color: favorited ? '#f5a623' : '#aaa' }}
      title={favorited ? 'お気に入りを解除' : 'お気に入りに追加'}
    >
      {favorited ? '★' : '☆'}
    </button>
  )
}
