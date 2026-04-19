'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  src: string
  alt?: string
}

export function ImageViewer({ src, alt = '添付画像' }: Props) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <>
      {/* サムネ表示：maxWidth固定のwrapperでwidth:100%にして全画像を同じ幅で揃える */}
      <div style={{ maxWidth: 280, width: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            cursor: 'zoom-in',
          }}
          className="hover:opacity-90"
        />
      </div>

      {/* オーバーレイ拡大 */}
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              width: 'auto',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
              cursor: 'default',
            }}
          />
          <button
            onClick={close}
            style={{
              position: 'absolute',
              top: 12,
              right: 16,
              color: '#fff',
              background: 'none',
              border: 'none',
              fontSize: 28,
              lineHeight: 1,
              cursor: 'pointer',
              opacity: 0.8,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
