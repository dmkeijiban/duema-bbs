'use client'

import { useState } from 'react'

export function PostLikeButton({ likeKey }: { likeKey: string }) {
  const [liked, setLiked] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = JSON.parse(localStorage.getItem('liked_posts') || '[]') as string[]
      return stored.includes(likeKey)
    } catch {
      return false
    }
  })

  const handleLike = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('liked_posts') || '[]') as string[]
      const newLiked = !liked
      const updated = newLiked
        ? [...stored, likeKey]
        : stored.filter(k => k !== likeKey)
      localStorage.setItem('liked_posts', JSON.stringify(updated))
      setLiked(newLiked)
    } catch { /* ignore */ }
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      className="text-[13px] transition-all select-none"
      style={{ color: liked ? '#e8a0b0' : '#ccc' }}
      title={liked ? 'いいね済み' : 'いいね'}
    >
      {liked ? '♥' : '♡'}
    </button>
  )
}
