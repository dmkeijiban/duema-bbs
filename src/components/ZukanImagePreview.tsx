'use client'

import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

type ZukanImagePreviewProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  aspectRatio?: string
}

function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', display: 'inline-block' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-12px',
            right: '-12px',
            zIndex: 1,
            background: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#374151',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
          aria-label="閉じる"
        >
          閉じる
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            display: 'block',
            maxWidth: '90vw',
            maxHeight: '90vh',
            objectFit: 'contain',
            borderRadius: '6px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            background: '#fff',
          }}
        />
      </div>
    </div>,
    document.body,
  )
}

export default function ZukanImagePreview({
  src,
  alt,
  className = '',
  imageClassName = '',
  aspectRatio = '63 / 88',
}: ZukanImagePreviewProps) {
  const [open, setOpen] = useState(false)
  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        className={`block w-full overflow-hidden bg-gray-100 cursor-zoom-in ${className}`}
        style={{ aspectRatio }}
        aria-label={`${alt}を拡大表示`}
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      </button>

      {open && <ImageModal src={src} alt={alt} onClose={handleClose} />}
    </>
  )
}
