#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.split('='); return [key, rest.join('=') || true] }))
const execute = args.has('--execute')
const full = args.has('--full')
const maxPages = Number(args.get('--max-pages') ?? 3)
const maxCards = Number(args.get('--max-cards') ?? 3)
const concurrency = Number(args.get('--concurrency') ?? 1)
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/official-catalog.checkpoint.json'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/official-catalog.preview.json'))
const startUrl = String(args.get('--start-url') ?? 'https://dm.takaratomy.co.jp/card/')
const contact = process.env.CARD_CATALOG_CONTACT?.trim()
const ua = `DuemaBBS-CardCatalog/1.0 (catalog maintenance; contact: ${contact || 'set CARD_CATALOG_CONTACT'})`

if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(maxCards) || maxCards < 1) throw new Error('上限は1以上の整数にしてください')
if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrencyは1以上の整数にしてください')
if (full && (!execute || args.get('--confirm') !== 'I_UNDERSTAND_FULL_CATALOG' || process.env.CARD_CATALOG_FULL_RUN !== 'YES')) throw new Error('全件相当は --execute --full --confirm=I_UNDERSTAND_FULL_CATALOG と CARD_CATALOG_FULL_RUN=YES の二重確認が必要です')
if (execute && !contact) throw new Error('実通信には CARD_CATALOG_CONTACT を設定してください')
if (!full && (maxPages > 3 || maxCards > 3)) throw new Error('検証実行は最大3ページ・最大3カードです。全件直前は人間確認が必要です')

let nextAllowedAt = 0
async function globalRateLimit() { const wait = Math.max(0, nextAllowedAt - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); nextAllowedAt = Date.now() + 1000 }
function retryDelay(response, attempt) { const retry = response?.headers.get('retry-after'); if (retry) { const seconds = Number(retry); if (Number.isFinite(seconds)) return seconds * 1000; const date = Date.parse(retry); if (Number.isFinite(date)) return Math.max(0, date - Date.now()) } return Math.min(30000, 1000 * 2 ** attempt) }
async function safeFetch(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await globalRateLimit(); const response = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'follow' })
    if (response.status === 403) throw new Error(`403のため即停止: ${url}`)
    if (response.status === 429 || response.status >= 500) { if (attempt === retries) throw new Error(`${response.status}が再試行上限: ${url}`); await new Promise(r => setTimeout(r, retryDelay(response, attempt))); continue }
    if (!response.ok) throw new Error(`${response.status}: ${url}`)
    return response
  }
  throw new Error('unreachable')
}
function robotsAllows(text, target) { const path = new URL(target).pathname; const rules = text.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean); let applies = false; for (const rule of rules) { const [key, ...valueParts] = rule.split(':'); const value = valueParts.join(':').trim(); if (key.toLowerCase() === 'user-agent') applies = value === '*'; if (applies && key.toLowerCase() === 'disallow' && value && path.startsWith(value)) return false } return true }
async function readJson(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')) } catch { return fallback } }

if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', requests: 0, startUrl, maxPages, maxCards, concurrency, checkpointPath, outputPath, userAgent: ua }, null, 2))
  process.exit(0)
}

const robots = await (await safeFetch('https://dm.takaratomy.co.jp/robots.txt')).text()
if (!robotsAllows(robots, startUrl)) throw new Error('robots.txtで禁止されているため停止しました')
const checkpoint = await readJson(checkpointPath, { pending: [startUrl], visited: [], cards: [], consecutiveErrors: 0 })
while (checkpoint.pending.length && checkpoint.visited.length < maxPages && checkpoint.cards.length < maxCards) {
  const url = checkpoint.pending.shift(); if (checkpoint.visited.includes(url)) continue
  try {
    const html = await (await safeFetch(url)).text(); checkpoint.visited.push(url); checkpoint.consecutiveErrors = 0
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(match => new URL(match[1], url).href).filter(href => href.startsWith('https://dm.takaratomy.co.jp/card/'))
    for (const href of links) if (!checkpoint.visited.includes(href) && !checkpoint.pending.includes(href)) checkpoint.pending.push(href)
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const imageUrl = html.match(/(?:property=["']og:image["'][^>]*content|content=["']([^"']+)["'][^>]*property=["']og:image)[="']+([^"']+)/i)?.slice(1).find(Boolean)
    if (title && /detail/.test(url)) checkpoint.cards.push({ source_key: new URL(url).searchParams.get('id') ?? url, name: title, official_page_url: url, image_url: imageUrl ?? null })
  } catch (error) { checkpoint.consecutiveErrors += 1; await mkdir(resolve(checkpointPath, '..'), { recursive: true }); await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2)); if (checkpoint.consecutiveErrors >= 3) throw new Error(`連続エラーで停止: ${error instanceof Error ? error.message : error}`) }
  await mkdir(resolve(checkpointPath, '..'), { recursive: true }); await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2))
}
await mkdir(resolve(outputPath, '..'), { recursive: true }); await writeFile(outputPath, JSON.stringify(checkpoint.cards.slice(0, maxCards), null, 2))
console.log(JSON.stringify({ pages: checkpoint.visited.length, cards: checkpoint.cards.length, checkpointPath, outputPath }, null, 2))
