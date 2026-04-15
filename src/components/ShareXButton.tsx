'use client'

interface Props {
  title: string
}

export function ShareXButton({ title }: Props) {
  const handleShare = () => {
    const url = window.location.href
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
    window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=600,height=400')
  }

  return (
    <button
      onClick={handleShare}
      className="text-white text-sm font-bold w-7 h-7 flex items-center justify-center rounded"
      style={{ background: '#000' }}
      title="Xでシェア"
    >
      𝕏
    </button>
  )
}
