'use client'

import { useState } from 'react'
import { DEFAULT_THREAD_THUMBNAIL } from '@/lib/thumbnail'

interface Props {
  src: string
  alt: string
  priority?: boolean
}

/**
 * サムネイル用画像コンポーネント。
 * Supabase Image Transformation（render URL）を使用し、
 * 読み込みエラー時（Free プランへのダウングレード後など）は
 * DEFAULT_THREAD_THUMBNAIL（SVG）に自動フォールバックする。
 */
export function SafeThumbnail({ src, alt, priority }: Props) {
  const [imgSrc, setImgSrc] = useState(src)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(DEFAULT_THREAD_THUMBNAIL)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  )
}
