'use client'

import { useState } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  title: string
}

export function ShareXButton({ title }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = `${title.trim()}\n${url}`
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`

    capturePostHogEvent('x_share_click', {
      path: window.location.pathname,
      title,
    })

    window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=600,height=400')
  }

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('URLをコピーしてください', url)
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="h-7 rounded bg-black px-2 text-xs font-bold text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
        title="Xでシェア"
        type="button"
      >
        Xでシェア
      </button>
      <button
        onClick={handleCopy}
        className="h-7 rounded border border-blue-500 bg-white px-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 active:scale-[0.98]"
        type="button"
      >
        {copied ? 'URLをコピーしました' : 'URLをコピー'}
      </button>
    </>
  )
}
