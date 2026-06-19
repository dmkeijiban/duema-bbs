'use client'

import { useState } from 'react'

export function UserProfileShareButtons({ displayName }: { displayName: string }) {
  const [copied, setCopied] = useState(false)

  function shareX() {
    const text = encodeURIComponent(`${displayName}のプロフィール\n${window.location.href}`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener')
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('URLをコピーしてください', window.location.href)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={shareX}
        className="rounded border border-gray-800 bg-white px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        Xでシェア
      </button>
      <button
        type="button"
        onClick={copyUrl}
        className="rounded border border-blue-500 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        {copied ? 'URLをコピーしました' : 'URLをコピー'}
      </button>
    </div>
  )
}
