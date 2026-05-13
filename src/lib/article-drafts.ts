import fs from 'node:fs/promises'
import path from 'node:path'
import type { Block } from '@/types/fixed-pages'

const DRAFT_DIR = path.join(process.cwd(), 'drafts', 'articles')

export interface ArticleDraftSummary {
  file: string
  title: string
  sourceUrl: string
  generatedAt: string
  status: string
  size: number
}

export interface ArticleDraft extends ArticleDraftSummary {
  markdown: string
  blocks: Block[]
}

function isMarkdownFile(file: string) {
  return file.endsWith('.md') && !file.endsWith('.quality.md') && !file.endsWith('.source.md')
}

function assertSafeDraftFile(file: string) {
  if (!isMarkdownFile(file)) throw new Error('Invalid draft file')
  if (file.includes('/') || file.includes('\\') || file.includes('..')) {
    throw new Error('Invalid draft file path')
  }
}

function parseFrontmatter(raw: string) {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end < 0) return { meta: {}, body: raw }

  const meta: Record<string, string> = {}
  const block = raw.slice(4, end)
  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^"|"$/g, '')
    meta[key] = value
  }
  return { meta, body: raw.slice(end + 5).trim() }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function pushTextBlock(blocks: Block[], lines: string[]) {
  if (lines.length === 0) return
  const html = lines
    .join('\n')
    .split(/\n{2,}/)
    .map(paragraph => `<p>${inlineMarkdownToHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  if (html) blocks.push({ type: 'text', content: html })
  lines.length = 0
}

export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.split(/\r?\n/)
  const textLines: string[] = []

  for (const line of lines) {
    const image = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*$/)
    if (image) {
      pushTextBlock(blocks, textLines)
      blocks.push({ type: 'image', url: image[2], alt: image[1] })
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      pushTextBlock(blocks, textLines)
      const level = Math.min(heading[1].length, 3)
      blocks.push({ type: 'text', content: `<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>` })
      continue
    }

    textLines.push(line)
  }

  pushTextBlock(blocks, textLines)
  return blocks
}

function titleFromMarkdown(markdown: string, fallback: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback.replace(/\.md$/i, '')
}

export function slugFromDraft(file: string) {
  const code = file.match(/DM\d{2}-[A-Z]+[0-9]+/i)?.[0]?.toLowerCase() ?? 'draft'
  return `article-${code}`
}

export async function listArticleDrafts(): Promise<ArticleDraftSummary[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(DRAFT_DIR)
  } catch {
    return []
  }

  const drafts = await Promise.all(entries.filter(isMarkdownFile).map(async file => {
    const fullPath = path.join(DRAFT_DIR, file)
    const [raw, stat] = await Promise.all([
      fs.readFile(fullPath, 'utf8'),
      fs.stat(fullPath),
    ])
    const { meta, body } = parseFrontmatter(raw)
    return {
      file,
      title: titleFromMarkdown(body, file),
      sourceUrl: meta.source_url ?? '',
      generatedAt: meta.generated_at ?? stat.mtime.toISOString(),
      status: meta.status ?? 'draft',
      size: stat.size,
    }
  }))

  return drafts.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
}

export async function readArticleDraft(file: string): Promise<ArticleDraft> {
  assertSafeDraftFile(file)
  const raw = await fs.readFile(path.join(DRAFT_DIR, file), 'utf8')
  const { meta, body } = parseFrontmatter(raw)
  return {
    file,
    title: titleFromMarkdown(body, file),
    sourceUrl: meta.source_url ?? '',
    generatedAt: meta.generated_at ?? '',
    status: meta.status ?? 'draft',
    size: Buffer.byteLength(raw),
    markdown: body,
    blocks: markdownToBlocks(body),
  }
}

