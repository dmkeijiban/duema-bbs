/**
 * ホットリンク禁止サイトの画像URLをサーバーサイドプロキシ経由のURLに変換する。
 * 対象外のURLはそのまま返す。null は null のまま。
 */
const PROXY_HOSTS = ['bbs.animanch.com']

export function resolveImageUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    if (PROXY_HOSTS.includes(hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {
    // URLパース失敗はそのまま返す
  }
  return url
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  if (hours < 24) return `${hours}時間前`
  if (days < 30) return `${days}日前`

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// animanch形式: 26/04/11(土) 13:44:02
// JST(UTC+9)に固定 — サーバー(UTC)とブラウザのハイドレーションミスマッチを防ぐため
// d.getHours()等のローカルタイムメソッドは使わず、UTC+9オフセットを手動加算してUTCメソッドで取得する
export function formatDateTimeJP(dateStr: string): string {
  const d = new Date(dateStr)
  // UTC+9オフセットを加算してJST相当のUTC時刻として扱う
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const yy = String(jst.getUTCFullYear()).slice(2)
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(jst.getUTCDate()).padStart(2, '0')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const day = days[jst.getUTCDay()]
  const hh = String(jst.getUTCHours()).padStart(2, '0')
  const min = String(jst.getUTCMinutes()).padStart(2, '0')
  return `${yy}/${mm}/${dd}(${day}) ${hh}:${min}`
}
