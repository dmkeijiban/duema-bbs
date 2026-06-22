'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  src: string
  alt?: string
  priority?: boolean
}

export function ImageViewer({ src, alt = '添付画像', priority = false }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (error) return null

  return (
    <>
      <div style={{ maxWidth: 500, width: '100%', textAlign: 'left', marginBottom: '1rem' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setError(true)}
          onClick={() => setOpen(true)}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: 300,
            display: 'block',
            cursor: 'zoom-in',
            objectFit: 'contain',
          }}
          className="hover:opacity-90"
        />
      </div>

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
              width: '95vw',
              height: '95vh',
              objectFit: 'contain',
              display: 'block',
              cursor: 'default',
            }}
          />
          <button
            onClick={close}
            aria-label="閉じる"
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
            ×
          </button>
        </div>
      )}
    </>
  )
}
