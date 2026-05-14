import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')

function parseArgs(argv) {
  const args = { slug: '', file: '', title: '' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--slug') args.slug = argv[++i] ?? ''
    else if (argv[i] === '--file') args.file = argv[++i] ?? ''
    else if (argv[i] === '--title') args.title = argv[++i] ?? ''
  }
  return args
}

async function loadEnvFile(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      let value = trimmed.slice(index + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Optional local env file.
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/《([^》]+)》/g, '<span class="card-name">《$1》</span>')
}

function markdownToHtml(markdown) {
  const html = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let paragraph = []

  function flushParagraph() {
    if (!paragraph.length) return
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      continue
    }
    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (image) {
      flushParagraph()
      html.push(`<figure class="card-image"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"></figure>`)
      continue
    }
    const h2 = trimmed.match(/^##\s+(.+)$/)
    if (h2) {
      flushParagraph()
      html.push(`<h2>${inlineMarkdown(h2[1])}</h2>`)
      continue
    }
    const h3 = trimmed.match(/^###\s+(.+)$/)
    if (h3) {
      flushParagraph()
      html.push(`<h3>${inlineMarkdown(h3[1])}</h3>`)
      continue
    }
    if (/^#\s+/.test(trimmed)) {
      continue
    }
    paragraph.push(trimmed)
  }

  flushParagraph()
  return html.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.slug || !args.file) {
    throw new Error('Usage: node scripts/content/update-manual-summary-from-draft.mjs --slug article-dm26-rp1 --file drafts/articles/file.md --title "Title"')
  }

  await loadEnvFile(path.join(ROOT_DIR, '.env.local'))
  await loadEnvFile(path.join(ROOT_DIR, '.env.production.local'))
  await loadEnvFile(path.join(ROOT_DIR, '.env.vercel.production.local'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const markdown = await fs.readFile(path.resolve(ROOT_DIR, args.file), 'utf8')
  const title = args.title || markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || args.slug
  const body = markdownToHtml(markdown)

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('summaries')
      .update({ title, body, threads: [] })
      .eq('slug', args.slug)
      .select('id, slug, title, published, type')
      .single()

    if (error) throw error
    console.log(JSON.stringify(data, null, 2))
    return
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  const baseUrl = process.env.SITE_URL || 'https://www.duema-bbs.com'
  if (!adminPassword) throw new Error('ADMIN_PASSWORD or Supabase service role is missing')
  const adminSecret = process.env.ADMIN_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'duema-bbs-admin-cookie-v1'
  const adminCookie = process.env.ADMIN_AUTH_COOKIE || createHash('sha256').update(`${adminPassword}:${adminSecret}`).digest('hex')
  let response = await fetch(`${baseUrl}/api/admin/summary/update`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `admin_auth=${adminCookie}`,
    },
    body: JSON.stringify({ slug: args.slug, title, body, threads: [] }),
  })
  if (response.status === 401) {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' })
    await page.fill('input[type="password"]', adminPassword)
    await page.click('button[type="submit"], button')
    await page.waitForLoadState('networkidle')
    const cookies = await page.context().cookies(baseUrl)
    await browser.close()
    const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
    response = await fetch(`${baseUrl}/api/admin/summary/update`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({ slug: args.slug, title, body, threads: [] }),
    })
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
  console.log(JSON.stringify({ ok: true, slug: args.slug, via: 'admin-api' }, null, 2))
}

main().catch(error => {
  console.error('[update-summary:error]', error.message)
  process.exitCode = 1
})
