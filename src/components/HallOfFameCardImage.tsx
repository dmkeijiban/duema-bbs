'use client'

import { useState } from 'react'

// 殿堂図鑑カードの画像。比率(63:88)を保ち薄い枠線付き。
// 画像URL未設定・読み込み失敗時はプレースホルダにフォールバックして崩れを防ぐ。
export function HallOfFameCardImage({
  src,
  name,
  officialUrl,
}: {
  src?: string
  name: string
  officialUrl?: string
}) {
  const [errored, setErrored] = useState(false)
  const showPlaceholder = !src || errored

  if (showPlaceholder) {
    return (
      <div
        className="flex items-center justify-center border border-gray-300 bg-gray-100 text-[10px] font-bold text-gray-400"
        style={{ aspectRatio: '63 / 88' }}
        aria-label={`${name} のカード画像（準備中）`}
      >
        画像準備中
      </div>
    )
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} カード画像`}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      className="block w-full border border-gray-300 object-cover"
      style={{ aspectRatio: '63 / 88' }}
    />
  )

  if (officialUrl) {
    return (
      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block [-webkit-tap-highlight-color:transparent]"
        title={`${name} を公式カードページで見る`}
      >
        {img}
      </a>
    )
  }
  return img
}
