'use client'

import { useEffect, useState } from 'react'

export default function TierImageZoom() {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLImageElement)) return

      const cardDialog = target.closest('[aria-labelledby="tier-card-title"]')
      if (!cardDialog) return

      event.preventDefault()
      event.stopPropagation()
      setImage({ src: target.currentSrc || target.src, alt: target.alt })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (!image) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImage(null)
    }

    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [image])

  if (!image) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${image.alt || 'カード'}の拡大画像`}
      onClick={() => setImage(null)}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-3"
    >
      <button
        type="button"
        aria-label="拡大画像を閉じる"
        onClick={() => setImage(null)}
        className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-3xl leading-none text-white"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        onClick={event => event.stopPropagation()}
        className="max-h-[94vh] max-w-[96vw] object-contain"
      />
    </div>
  )
}
