import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')
const DRAFT_DIR = path.join(ROOT_DIR, 'drafts', 'articles')

function parseArgs(argv) {
  const args = { file: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') args.file = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true
  }
  return args
}

function usage() {
  return `Usage:
  npm run content:import-draft -- --file "2026-05-13-DM26-RP1-....md"
`
}

async function loadEnvFile(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index < 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

function assertSafeDraftFile(file) {
  if (!file || !file.endsWith('.md')) throw new Error('Markdown draft file is required')
  if (file.includes('/') || file.includes('\\') || file.includes('..')) {
    throw new Error('Invalid draft file path')
  }
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end < 0) return { meta: {}, body: raw }
  const meta = {}
  for (const line of raw.slice(4, end).split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index < 0) continue
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^"|"$/g, '')
  }
  return { meta, body: raw.slice(end + 5).trim() }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function pushHtmlParagraphs(parts, lines) {
  if (lines.length === 0) return
  const html = lines
    .join('\n')
    .split(/\n{2,}/)
    .map(paragraph => `<p>${inlineMarkdownToHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  if (html) parts.push(html)
  lines.length = 0
}

function markdownToSummaryHtml(markdown) {
  const parts = []
  const textLines = []
  let skippedTitle = false

  for (const line of markdown.split(/\r?\n/)) {
    const image = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*$/)
    if (image) {
      pushHtmlParagraphs(parts, textLines)
      parts.push(`<p><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"></p>`)
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      pushHtmlParagraphs(parts, textLines)
      const rawLevel = heading[1].length
      if (rawLevel === 1 && !skippedTitle) {
        skippedTitle = true
        continue
      }
      const level = Math.min(rawLevel + 1, 3)
      parts.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`)
      continue
    }

    textLines.push(line)
  }

  pushHtmlParagraphs(parts, textLines)
  return parts.join('\n')
}

function titleFromMarkdown(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback.replace(/\.md$/i, '')
}

function normalizeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function slugFromDraft(file) {
  const code = file.match(/DM\d{2}-[A-Z]+[0-9]+/i)?.[0]?.toLowerCase() ?? 'draft'
  return normalizeSlug(`article-${code}`)
}

async function uniqueSlug(supabase, base) {
  const cleanBase = normalizeSlug(base) || 'article-draft'
  for (let i = 0; i < 100; i += 1) {
    const slug = i === 0 ? cleanBase : `${cleanBase}-${i + 1}`
    const { data, error } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data) return slug
  }
  return `${cleanBase}-${Date.now()}`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.file) {
    console.log(usage())
    return
  }
  assertSafeDraftFile(args.file)

  await loadEnvFile(path.join(ROOT_DIR, '.env.local'))
  await loadEnvFile(path.join(ROOT_DIR, '.env.production.local'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or Supabase key is missing')
  }

  const raw = await fs.readFile(path.join(DRAFT_DIR, args.file), 'utf8')
  const { body } = parseFrontmatter(raw)
  const title = titleFromMarkdown(body, args.file)
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const slug = await uniqueSlug(supabase, slugFromDraft(args.file))
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase.from('summaries').insert({
    type: 'manual',
    title,
    slug,
    period_start: today,
    period_end: today,
    threads: [],
    published: false,
    body: markdownToSummaryHtml(body),
  }).select('id, slug, title, published, type').single()

  if (error) throw error
  console.log(JSON.stringify(data, null, 2))
}

main().catch(error => {
  console.error('[import-draft:error]', error.message)
  process.exitCode = 1
})
