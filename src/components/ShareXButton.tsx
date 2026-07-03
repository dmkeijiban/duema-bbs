'use client'

import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  title: string
}

export function ShareXButton({ title }: Props) {
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

  return (
    <button
      onClick={handleShare}
      className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-black bg-black px-2 text-xs font-bold leading-none text-white transition-all duration-100 hover:bg-gray-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 sm:h-auto sm:min-w-0 sm:border-gray-300 sm:bg-white sm:px-3 sm:py-1.5 sm:text-gray-800 sm:hover:bg-gray-50"
      title="Xでシェア"
      type="button"
    >
      <span className="sm:hidden">X</span>
      <span className="hidden sm:inline">Xでシェア</span>
    </button>
  )
}
