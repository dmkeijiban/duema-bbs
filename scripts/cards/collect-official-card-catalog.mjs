#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const ORIGIN = 'https://dm.takaratomy.co.jp'
const SEARCH_URL = `${ORIGIN}/card/`
const ROBOTS_URL = `${ORIGIN}/robots.txt`
const USER_AGENT = 'DuemaBBSCardImporter/1.0 (+https://www.duema-bbs.com/contact)'
// タイマー誤差があっても実測1秒を下回らない安全余裕。
const MIN_INTERVAL_MS = 1_100
const MAX_EXPECTED_CARDS = 25_000
const REQUEST_TIMEOUT_MS = 20_000
const args = new Map(process.argv.slice(2).map((value) => { const [key, ...rest] = value.split('='); return [key, rest.join('=') || true] }))
const execute = args.has('--execute')
const full = args.has('--full')
const maxPages = Number(args.get('--max-pages') ?? 3)
const maxCards = Number(args.get('--max-cards') ?? 3)
const concurrency = Number(args.get('--concurrency') ?? 1)
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/official-catalog.checkpoint.json'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/official-catalog.json'))

if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(maxCards) || maxCards < 1) throw new Error('上限は1以上の整数にしてください')
if (concurrency !== 1) throw new Error('安全のため concurrency は1だけ使用できます')
if (!full && (maxPages > 3 || maxCards > 3)) throw new Error('検証実行は最大3ページ・最大3カードです')
if (full && (!execute || args.get('--confirm') !== 'I_UNDERSTAND_FULL_CATALOG' || process.env.CARD_CATALOG_FULL_RUN !== 'YES')) throw new Error('全件実行には --execute --full --confirm=I_UNDERSTAND_FULL_CATALOG と CARD_CATALOG_FULL_RUN=YES が必要です')

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
let nextAllowedAt = 0
let lastRequestAt = null
let minimumObservedIntervalMs = null
let consecutive5xx = 0

async function rateLimit() {
  const now = Date.now()
  if (now < nextAllowedAt) await sleep(nextAllowedAt - now)
  const startedAt = Date.now()
  if (lastRequestAt !== null) {
    const interval = startedAt - lastRequestAt
    minimumObservedIntervalMs = minimumObservedIntervalMs === null ? interval : Math.min(minimumObservedIntervalMs, interval)
  }
  lastRequestAt = startedAt
  nextAllowedAt = startedAt + MIN_INTERVAL_MS
}

async function safeFetch(url, init = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await rateLimit()
    let response
    try {
      response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { ...init.headers, 'User-Agent': USER_AGENT } })
    } catch (error) {
      if (attempt === 2) throw error
      await sleep(Math.min(30_000, 2_000 * (2 ** attempt)))
      continue
    }
    if (response.status === 403 || response.status === 429) throw new Error(`${response.status}を検出したため即時停止: ${url}`)
    if (response.status >= 500) {
      consecutive5xx += 1
      if (consecutive5xx >= 3) throw new Error(`5xxが3回連続したため停止: ${url}`)
      await sleep(Math.min(30_000, 2_000 * (2 ** attempt)))
      continue
    }
    consecutive5xx = 0
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
    return response
  }
  throw new Error(`再試行上限: ${url}`)
}

function robotsAllows(text, targetUrl) {
  const path = new URL(targetUrl).pathname
  const groups = text.split(/(?=^\s*user-agent\s*:)/gim)
  const rules = groups.filter((group) => /^\s*user-agent\s*:\s*\*/im.test(group)).flatMap((group) => [...group.matchAll(/^\s*(allow|disallow)\s*:\s*([^#\r\n]*)/gim)].map((match) => ({ type: match[1].toLowerCase(), path: match[2].trim() })).filter((rule) => rule.path && path.startsWith(rule.path)))
  rules.sort((a, b) => b.path.length - a.path.length)
  return rules[0]?.type !== 'disallow'
}

const decode = (value) => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
function parseSearchPage(html) {
  const count = Number(html.match(/id\s*=\s*["']total_count["'][^>]*>\s*([0-9,]+)/i)?.[1]?.replaceAll(',', '') ?? html.match(/([0-9,]+)\s*枚/)?.[1]?.replaceAll(',', ''))
  const entries = [...html.matchAll(/href=["']\/card\/detail\/\?id=([^"']+)["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']*\/cardthumb\/[^"']+)["']/gi)].map((match) => ({ source_key: decodeURIComponent(match[1]), thumbnail_url: new URL(match[2], ORIGIN).href }))
  return { count, entries: [...new Map(entries.map((entry) => [entry.source_key, entry])).values()] }
}

function field(html, className) { return decode(html.match(new RegExp(`<td[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i'))?.[1] ?? '') || null }
function parseDetail(html, sourceKey, thumbnailUrl) {
  const nameHtml = html.match(/<h3[^>]+class=["'][^"']*card-name[^"']*["'][^>]*>([\s\S]*?)<span[^>]+class=["'][^"']*packname/i)?.[1]
  const imagePath = html.match(/<div[^>]+class=["'][^"']*card-img[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1]
  if ((!nameHtml || !imagePath) && /<title>\s*\([^<]*\?\?\?[^<]*\)\s*\|/i.test(html)) return null
  if (!nameHtml || !imagePath) throw new Error(`必須項目(name/image)を取得できません: ${sourceKey}`)
  const pack = decode(html.match(/<span[^>]+class=["'][^"']*packname[^"']*["'][^>]*>\s*\(([^)]*)\)/i)?.[1] ?? '')
  return {
    source_key: sourceKey,
    name: decode(nameHtml),
    name_kana: null,
    official_page_url: `${SEARCH_URL}detail/?id=${encodeURIComponent(sourceKey)}`,
    image_url: new URL(imagePath, ORIGIN).href,
    thumbnail_url: thumbnailUrl,
    set_name: pack || null,
    card_number: pack?.split(/\s+/).slice(1).join(' ') || null,
    card_type: field(html, 'type'),
    civilization: field(html, 'civil'),
    cost: field(html, 'cost'),
  }
}

async function readCheckpoint() { try { return JSON.parse(await readFile(checkpointPath, 'utf8')) } catch { return { nextPage: 1, pending: [], cards: [], failures: [], skipped: 0, totalExpected: null, requests: 0 } } }
async function saveCheckpoint(checkpoint) { await mkdir(dirname(checkpointPath), { recursive: true }); await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2)) }

if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', requests: 0, full, maxPages, maxCards, concurrency, minIntervalMs: MIN_INTERVAL_MS, maxExpectedCards: MAX_EXPECTED_CARDS, userAgent: USER_AGENT, checkpointPath, outputPath }, null, 2))
  process.exit(0)
}

const robots = await (await safeFetch(ROBOTS_URL)).text()
if (!robotsAllows(robots, SEARCH_URL) || !robotsAllows(robots, `${SEARCH_URL}detail/`)) throw new Error('robots.txtで対象パスが禁止されているため停止')
const checkpoint = await readCheckpoint()

while (checkpoint.cards.length < maxCards && (checkpoint.pending.length || checkpoint.nextPage <= maxPages)) {
  if (!checkpoint.pending.length) {
    const body = new URLSearchParams({ pagenum: String(checkpoint.nextPage), samename: 'show' })
    const html = await (await safeFetch(SEARCH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).text()
    checkpoint.requests += 1
    const page = parseSearchPage(html)
    if (!Number.isFinite(page.count) || !page.entries.length) throw new Error(`検索HTMLの必須項目を取得できません: page ${checkpoint.nextPage}`)
    if (page.count > MAX_EXPECTED_CARDS) throw new Error(`想定件数超過(${page.count} > ${MAX_EXPECTED_CARDS})のため停止`)
    checkpoint.totalExpected = page.count
    const known = new Set(checkpoint.cards.map((card) => card.source_key))
    checkpoint.pending.push(...page.entries.filter((entry) => !known.has(entry.source_key)))
    checkpoint.nextPage += 1
    await saveCheckpoint(checkpoint)
  }

  const entry = checkpoint.pending.shift()
  if (!entry) continue
  try {
    const url = `${SEARCH_URL}detail/?id=${encodeURIComponent(entry.source_key)}`
    const html = await (await safeFetch(url)).text()
    checkpoint.requests += 1
    const card = parseDetail(html, entry.source_key, entry.thumbnail_url)
    if (card) checkpoint.cards.push(card)
    else checkpoint.skipped += 1
  } catch (error) {
    checkpoint.failures.push({ source_key: entry.source_key, error: error instanceof Error ? error.message : String(error) })
    await saveCheckpoint(checkpoint)
    throw error
  }
  await saveCheckpoint(checkpoint)
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(checkpoint.cards, null, 2))
console.log(JSON.stringify({ expected: checkpoint.totalExpected, success: checkpoint.cards.length, failed: checkpoint.failures.length, skipped: checkpoint.skipped, requests: checkpoint.requests, nextPage: checkpoint.nextPage, remaining: checkpoint.pending.length, minimumObservedIntervalMs, checkpointPath, outputPath }, null, 2))
