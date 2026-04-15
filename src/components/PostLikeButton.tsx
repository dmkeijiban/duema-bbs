'use client'

import { useState, useEffect } from 'react'

export function PostLikeButton({ likeKey }: { likeKey: string }) {
  const [liked, setLiked] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = JSON.parse(localStorage.getItem('liked_posts') || '[]') as string[]
      setLiked(stored.includes(likeKey))
    } catch { /* ignore */ }
  }, [likeKey])

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

  if (!mounted) {
    return <span className="text-[13px]" style={{ color: '#e8a0b0' }}>♡</span>
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
