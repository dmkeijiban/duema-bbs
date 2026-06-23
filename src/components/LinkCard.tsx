'use client'

import { useEffect, useState } from 'react'

interface OgpData {
  title: string | null
  description: string | null
  image: string | null
  url: string
  hostname: string
}

// YouTube 動画URLから videoId を抽出（host も検証。playlist/チャンネル等はnull）
function getYouTubeVideoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

// 「- YouTube」「YouTube」「www.youtube.com」など実質空のタイトルは使わない
function isUsableTitle(title: string | null | undefined): title is string {
  if (!title) return false
  const t = title.trim()
  if (t === '') return false
  const unusable = ['- YouTube', 'YouTube', 'www.youtube.com', 'youtube.com']
  if (unusable.includes(t)) return false
  // URL そのものをタイトルに使っていたら除外
  if (/^https?:\/\//.test(t)) return false
  return true
}

// YouTube 専用カード。OGP/oEmbed が失敗・未取得でも videoId から静的サムネで表示する。
// サムネは i.ytimg.com のホットリンク可能URLを直接使い、プロキシも next/image も使わない。
// loading=true のとき、右側はスケルトン表示にしてチラつきを抑える。
function YouTubeCard({
  url,
  videoId,
  title,
  channelName,
  loading,
}: {
  url: string
  videoId: string
  title: string | null
  channelName: string | null
  loading: boolean
}) {
  const displayTitle = isUsableTitle(title) ? title : loading ? null : 'YouTube動画'
  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="hover:bg-gray-50 transition-colors"
      style={{
        maxWidth: 620,
        display: 'block',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        margin: '8px 0',
        textDecoration: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', height: 112, overflow: 'hidden' }}>
        {/* サムネイル */}
        <div
          style={{
            position: 'relative',
            width: 160,
            minHeight: 112,
            flexShrink: 0,
            background: '#000',
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            referrerPolicy="no-referrer"
            onError={e => {
              const img = e.target as HTMLImageElement
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1'
                img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
              } else {
                img.style.display = 'none'
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 112, display: 'block' }}
          />
          {/* 再生マーク */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 38,
              height: 26,
              borderRadius: 6,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 0,
                height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: '10px solid #fff',
                marginLeft: 2,
              }}
            />
          </span>
        </div>
        {/* テキスト列 */}
        <div
          style={{
            padding: '10px 12px',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div>
            {loading ? (
              /* スケルトン：タイトル2行 */
              <>
                <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '70%' }} />
              </>
            ) : (
              <p
                style={{
                  fontSize: 14,
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
                {displayTitle}
              </p>
            )}
            {!loading && channelName && (
              <p
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  margin: '4px 0 0',
                }}
              >
                {channelName}
              </p>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>YouTube</p>
        </div>
      </div>
    </a>
  )
}

export function LinkCard({ url }: { url: string }) {
  const [data, setData] = useState<OgpData | null>(null)
  const [failed, setFailed] = useState(false)
  const youtubeVideoId = getYouTubeVideoId(url)

  useEffect(() => {
    // YouTube は &v=yt2 を付けてキャッシュキーを切り替える。
    // PR #155 以前に古いスクレイプ結果がキャッシュされていた場合でもバイパスできる。
    const fetchUrl = youtubeVideoId
      ? `/api/ogp?url=${encodeURIComponent(url)}&v=yt2`
      : `/api/ogp?url=${encodeURIComponent(url)}`
    fetch(fetchUrl)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: OgpData & { error?: string }) => {
        if (d.error) setFailed(true)
        else setData(d)
      })
      .catch(() => setFailed(true))
  }, [url, youtubeVideoId])

  // data===null かつ failed でなければ oEmbed 取得待ち
  const loading = data === null && !failed

  // YouTube は OGP の成否に関わらず専用カードで表示（oEmbed の title/author_name が取れていれば優先）。
  if (youtubeVideoId) {
    return (
      <YouTubeCard
        url={url}
        videoId={youtubeVideoId}
        title={data?.title ?? null}
        channelName={data?.description ?? null}
        loading={loading}
      />
    )
  }

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="text-blue-600 underline break-all block my-1 text-sm"
      >
        {url}
      </a>
    )
  }

  // OGP画像は /api/ogp-image プロキシ経由で取得（ホットリンク禁止・CORS対策）
  // refererパラメータに元ページURLを渡すことでcorocoro.jpなどのCDNの403を回避
  const proxiedImage = data?.image
    ? `/api/ogp-image?url=${encodeURIComponent(data.image)}&referer=${encodeURIComponent(data.url)}`
    : null

  if (!data) {
    return (
      <div
        style={{
          maxWidth: 620,
          height: 112,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
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
      rel="nofollow noopener noreferrer"
      className="hover:bg-gray-50 transition-colors"
      style={{
        maxWidth: 620,
        display: 'block',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        margin: '8px 0',
        textDecoration: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', height: 112, overflow: 'hidden' }}>
        {proxiedImage && (
          <div
            style={{
              width: 160,
              minHeight: 112,
              flexShrink: 0,
              background: '#f3f4f6',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImage}
              alt=""
              referrerPolicy="no-referrer"
              onError={e => {
                const img = e.target as HTMLImageElement
                // プロキシ失敗時はブラウザから直接取得を試みる（Refererなし）
                if (data?.image && !img.dataset.directFallback) {
                  img.dataset.directFallback = '1'
                  img.src = data.image
                } else {
                  img.parentElement!.style.display = 'none'
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 112, display: 'block' }}
            />
          </div>
        )}
        <div
          style={{
            padding: '10px 12px',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div>
            {data.title && (
              <p
                style={{
                  fontSize: 14,
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
                  fontSize: 13,
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
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
            {data.hostname}
          </p>
        </div>
      </div>
    </a>
  )
}
