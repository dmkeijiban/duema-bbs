'use client'

import { useState, useTransition } from 'react'
import { toggleFavorite } from '@/app/actions/thread'
import { Star } from 'lucide-react'
import clsx from 'clsx'

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
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
        favorited
          ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-yellow-300 dark:hover:border-yellow-600'
      )}
    >
      <Star
        className={clsx('w-4 h-4 transition-all', favorited ? 'fill-yellow-400 text-yellow-400' : '')}
      />
      {favorited ? 'お気に入り済み' : 'お気に入り'}
    </button>
  )
}
