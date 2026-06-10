'use client'

import { useState } from 'react'

export default function ShareButtons({ cardName }: { cardName: string }) {
  const [copied, setCopied] = useState(false)

  function shareX() {
    const text = encodeURIComponent(`${cardName} | デュエマ思い出図鑑`)
    const url = encodeURIComponent(window.location.href)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener')
  }

  function shareLine() {
    const url = encodeURIComponent(window.location.href)
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}`, '_blank', 'noopener')
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
        className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
        type="button"
      >
        Xでシェア
      </button>
      <button
        onClick={shareLine}
        className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
        type="button"
      >
        LINEでシェア
      </button>
      <button
        onClick={copyUrl}
        className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
        type="button"
      >
        {copied ? 'コピーしました！' : 'URLをコピー'}
      </button>
    </div>
  )
}
