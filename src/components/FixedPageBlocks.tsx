import type { Block } from '@/types/fixed-pages'

const SHOP_COLORS: Record<string, string> = {
  'Amazon': '#FF9900',
  '駿河屋': '#00b3ff',
}

// ますますつよいパックの駿河屋URL（全商品共通で使用）
const SURUGAYA_URL = 'https://x.gd/P6Gmd'

const PILL_STYLE = 'display:inline-flex;align-items:center;gap:4px;padding:4px 14px;color:white !important;text-decoration:none !important;font-weight:bold;border-radius:9999px;font-size:0.8125rem;'

// テキスト内の「●ショップ名」をピルボタンに変換
// ①●<a href="...">Amazon</a> → Amazonはそのhrefを維持してピルボタン化
// ②●駿河屋（プレーンテキスト）→ 共通URLでピルボタン化
function convertShopLinks(html: string): string {
  // ①リンク付きの「●<a>ショップ名</a>」パターン
  let result = html.replace(
    /●\s*<a\s([^>]*)>(.*?)<\/a>/g,
    (_match, attrs, label) => {
      const trimmed = label.trim()
      const color = SHOP_COLORS[trimmed] ?? '#0d6efd'
      return `<a ${attrs} style="${PILL_STYLE}background:${color};">🛒 ${trimmed}</a>`
    }
  )
  // ②プレーンテキストの「●駿河屋」→ 共通URLでピルボタン化
  result = result.replace(
    /●\s*駿河屋/g,
    `<a href="${SURUGAYA_URL}" target="_blank" rel="noopener noreferrer" style="${PILL_STYLE}background:#00b3ff;">🛒 駿河屋</a>`
  )
  return result
}

function parseInlineLinks(text: string): React.ReactNode[] {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const href = match[2]
    const isExternal = href.startsWith('http')
    parts.push(
      <a key={key++} href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-blue-600 underline hover:opacity-80">
        {match[1]}
      </a>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export function renderBlock(block: Block, i: number) {
  if (block.type === 'text') {
    const isHtml = block.content.trimStart().startsWith('<')
    if (isHtml) {
      // <p></p>（空行）はマージン相殺で潰れるため <p><br></p> に変換して高さを確保
      // ●Amazon / ●駿河屋 などのテキストリンクをピルボタンに変換
      const html = convertShopLinks(block.content.replace(/<p><\/p>/gi, '<p><br></p>'))
      return (
        <div key={i} className="text-sm text-gray-800 leading-relaxed rich-content"
          dangerouslySetInnerHTML={{ __html: html }} />
      )
    }
    return (
      <div key={i} className="text-sm text-gray-800 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
        {parseInlineLinks(block.content)}
      </div>
    )
  }

  if (block.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    const img = <img src={block.url} alt={block.alt ?? ''} loading="lazy"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      className="border border-gray-100" />
    if (block.link) {
      return (
        <a key={i} href={block.link} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', maxWidth: 600 }}>
          {img}
        </a>
      )
    }
    return <div key={i} style={{ maxWidth: 600 }}>{img}</div>
  }

  if (block.type === 'links') {
    if (!block.items?.length) return null
    return (
      <div key={i} className="flex flex-wrap gap-2">
        {block.items.map((item, j) => (
          <a key={j} href={item.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white rounded-full shadow-sm hover:opacity-80 transition-opacity"
            style={{ backgroundColor: item.color || '#0d6efd' }}>
            🛒 {item.label}
          </a>
        ))}
      </div>
    )
  }

  if (block.type === 'button') {
    const isExternal = block.url.startsWith('http')
    return (
      <div key={i}>
        <a href={block.url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-block px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          style={{ background: '#0d6efd' }}>
          {block.label}
        </a>
      </div>
    )
  }

  return null
}
