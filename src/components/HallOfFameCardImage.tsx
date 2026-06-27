'use client'

import { useState, useEffect, useCallback } from 'react'

// 殿堂図鑑カードの画像。比率(63:88)を保ち薄い枠線付き。
// クリックで外部サイトには飛ばず、思い出図鑑(ImageViewer)と同じ要領でその場で拡大表示する。
// 画像URL未設定・読み込み失敗時はプレースホルダにフォールバックして崩れを防ぐ。
export function HallOfFameCardImage({
  src,
  name,
}: {
  src?: string
  name: string
}) {
  const [errored, setErrored] = useState(false)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!src || errored) {
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

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} カード画像`}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in border border-gray-300 object-cover hover:opacity-90"
        style={{ aspectRatio: '63 / 88' }}
      />

      {open && (
        <div
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${name} カード画像（拡大）`}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          style={{ cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${name} カード画像（拡大）`}
            onClick={e => e.stopPropagation()}
            className="block"
            style={{ width: '95vw', height: '95vh', objectFit: 'contain', cursor: 'default' }}
          />
          <button
            onClick={close}
            aria-label="閉じる"
            className="absolute right-4 top-3 text-3xl leading-none text-white opacity-80"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
