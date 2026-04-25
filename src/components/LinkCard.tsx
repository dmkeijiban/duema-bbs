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
      .then(r => r.ok ? r.json() : Promise.reject())
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
        className="text-blue-600 underline break-all block my-1"
      >
        {url}
      </a>
    )
  }

  if (!data) {
    return <div className="text-xs text-gray-400 py-1">リンクを読み込み中...</div>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ maxWidth: 480, textDecoration: 'none', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', margin: '6px 0' }}
      className="hover:bg-gray-50 transition-colors"
    >
      {data.image && (
        <div style={{ width: 120, minHeight: 80, flexShrink: 0, background: '#f3f4f6', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 80 }}
          />
        </div>
      )}
      <div style={{ padding: '6px 8px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 80 }}>
        <div>
          {data.title && (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
              {data.title}
            </p>
          )}
          {data.description && (
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '4px 0 0' }}>
              {data.description}
            </p>
          )}
        </div>
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, margin: '4px 0 0' }}>
          {data.hostname}
        </p>
      </div>
    </a>
  )
}
