'use client'

import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  title: string
}

const X_SHARE_SUFFIX = '#デュエマ @dmkeijiban'

export function ShareXButton({ title }: Props) {
  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = `${title.trim()} ${url} ${X_SHARE_SUFFIX}`
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
      className="text-white text-sm font-bold w-7 h-7 flex items-center justify-center rounded"
      style={{ background: '#000' }}
      title="Xでシェア"
    >
      X
    </button>
  )
}
