'use client'

import { useState } from 'react'

export default function PackShareButtons({ packName }: { packName: string }) {
  const [copied, setCopied] = useState(false)

  function shareX() {
    const text = encodeURIComponent(`${packName} | デュエマ思い出図鑑`)
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener')
  }

  function shareLine() {
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}`, '_blank', 'noopener')
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('URLをコピーしてください', window.location.href)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={shareX}
        className="rounded border border-black bg-black px-3 py-1.5 text-xs font-bold text-white transition-all duration-100 hover:bg-gray-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
        type="button"
      >
        Xでシェア
      </button>
      <button
        onClick={shareLine}
        className="rounded border border-[#06c755] bg-[#06c755] px-3 py-1.5 text-xs font-bold text-white transition-all duration-100 hover:bg-[#05b84f] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        type="button"
      >
        LINEでシェア
      </button>
      <button
        onClick={copyUrl}
        className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-all duration-100 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        type="button"
      >
        {copied ? 'コピーしました！' : 'URLをコピー'}
      </button>
    </div>
  )
}
