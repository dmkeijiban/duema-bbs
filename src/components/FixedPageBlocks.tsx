import type { Block } from '@/types/fixed-pages'

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
      const html = block.content.replace(/<p><\/p>/gi, '<p><br></p>')
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
