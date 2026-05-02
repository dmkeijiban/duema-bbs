'use client'

import { useEffect, useState } from 'react'

interface OgpData {
  title: string | null
  description: string | null
  image: string | null
  url: string
  hostname: string
}

export function LinkCard({ url }: { url: string }) {
  const [data, setData] = useState<OgpData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: OgpData & { error?: string }) => {
        if (d.error) setFailed(true)
        else setData(d)
      })
      .catch(() => setFailed(true))
  }, [url])

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all block my-1 text-sm"
      >
        {url}
      </a>
    )
  }

  // OGP画像は /api/ogp がサーバー側でbase64 data URLとして取得済み（ホットリンク禁止対策）
  const proxiedImage = data?.image ?? null

  if (!data) {
    return (
      <div
        style={{
          maxWidth: 560,
          height: 96,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          margin: '8px 0',
          background: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
        }}
      >
        <span className="text-xs text-gray-400">リンクを読み込み中...</span>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:bg-gray-50 transition-colors"
      style={{
        maxWidth: 560,
        display: 'block',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        margin: '8px 0',
        textDecoration: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', minHeight: 96 }}>
        {proxiedImage && (
          <div
            style={{
              width: 140,
              minHeight: 96,
              flexShrink: 0,
              background: '#f3f4f6',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImage}
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 96, display: 'block' }}
            />
          </div>
        )}
        <div
          style={{
            padding: '8px 10px',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 96,
          }}
        >
          <div>
            {data.title && (
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1f2937',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  margin: 0,
                }}
              >
                {data.title}
              </p>
            )}
            {data.description && (
              <p
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  margin: '4px 0 0',
                }}
              >
                {data.description}
              </p>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
            {data.hostname}
          </p>
        </div>
      </div>
    </a>
  )
}
