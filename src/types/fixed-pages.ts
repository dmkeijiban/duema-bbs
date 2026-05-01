export interface TextBlock { type: 'text'; content: string; link?: string }
export interface ImageBlock { type: 'image'; url: string; alt?: string; link?: string }
export interface ButtonBlock { type: 'button'; label: string; url: string }
export interface LinksItem { label: string; url: string; color?: string }
export interface LinksBlock { type: 'links'; items: LinksItem[]; surugaya_url?: string }
export type Block = TextBlock | ImageBlock | ButtonBlock | LinksBlock

export interface NavPage {
  id: number
  title: string
  slug: string
  nav_label: string
  sort_order: number
  external_url: string | null
}

export interface FixedPage extends NavPage {
  content: Block[]
  is_published: boolean
  show_in_nav: boolean
}

export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((b): b is Block => {
    if (!b || typeof b !== 'object') return false
    const t = (b as Record<string, unknown>).type
    return t === 'text' || t === 'image' || t === 'button' || t === 'links'
  })
}
