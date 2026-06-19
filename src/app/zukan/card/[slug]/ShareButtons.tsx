'use client'

import { useState } from 'react'

export default function ShareButtons({ cardName }: { cardName: string }) {
  const [copied, setCopied] = useState(false)

  function shareX() {
    const text = encodeURIComponent(`${cardName}の思い出\n${window.location.href}`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener')
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // フォールバック: prompt
      prompt('URLをコピーしてください', window.location.href)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={shareX}
        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-all duration-100 hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        type="button"
      >
        Xでシェア
      </button>
      <button
        onClick={copyUrl}
        className="rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-all duration-100 hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        type="button"
      >
        {copied ? 'URLをコピーしました' : 'URLをコピー'}
      </button>
    </div>
  )
}
