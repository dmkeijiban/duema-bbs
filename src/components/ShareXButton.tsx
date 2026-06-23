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
      className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-gray-900 px-1.5 text-xs font-bold leading-none text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
      title="Xでシェア"
      type="button"
    >
      X
    </button>
  )
}
