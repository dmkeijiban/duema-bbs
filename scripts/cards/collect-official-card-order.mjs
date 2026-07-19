#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const ORIGIN = 'https://dm.takaratomy.co.jp'
const SEARCH_URL = `${ORIGIN}/card/`
const USER_AGENT = 'DuemaBBSCardOrderVerifier/1.0 (+https://www.duema-bbs.com/contact)'
const MIN_INTERVAL_MS = 1_100
const PAGE_SIZE = 50
const MAX_CARDS = 25_000
const requestedMaxPages = Number(process.argv.find((arg) => arg.startsWith('--max-pages='))?.slice(12) ?? Number.MAX_SAFE_INTEGER)
if (!Number.isInteger(requestedMaxPages) || requestedMaxPages < 1) throw new Error('--max-pages は1以上の整数にしてください')
const outputPath = resolve(process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'data/cards/official-card-order.json')

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')

function parsePage(html) {
  const total = Number(html.match(/id\s*=\s*["']total_count["'][^>]*>\s*([0-9,]+)/i)?.[1]?.replaceAll(',', '') ?? html.match(/([0-9,]+)\s*枚/)?.[1]?.replaceAll(',', ''))
  const sourceKeys = [...html.matchAll(/href=["']\/card\/detail\/\?id=([^"']+)["']/gi)].map((match) => decode(decodeURIComponent(match[1])))
  return { total, sourceKeys: [...new Set(sourceKeys)] }
}

const rows = []
let expectedTotal = null
for (let page = 1; page <= requestedMaxPages; page += 1) {
  if (page > 1) await sleep(MIN_INTERVAL_MS)
  const response = await fetch(SEARCH_URL, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({ pagenum: String(page), samename: 'show' }),
  })
  if (response.status === 403 || response.status === 429) throw new Error(`${response.status}を検出したため停止`)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: page ${page}`)
  const parsed = parsePage(await response.text())
  if (!Number.isFinite(parsed.total) || parsed.total > MAX_CARDS || parsed.sourceKeys.length === 0) throw new Error(`検索HTML検証失敗: page ${page}`)
  expectedTotal ??= parsed.total
  for (const sourceKey of parsed.sourceKeys) rows.push({ source_key: sourceKey, official_sort_position: rows.length + 1 })
  if (rows.length >= Math.min(expectedTotal, requestedMaxPages * PAGE_SIZE) || parsed.sourceKeys.length < PAGE_SIZE) break
  if (page % 25 === 0) console.log(JSON.stringify({ page, collected: rows.length, expectedTotal }))
}

const expectedCollected = Math.min(expectedTotal, requestedMaxPages * PAGE_SIZE)
if (rows.length !== expectedCollected || new Set(rows.map((row) => row.source_key)).size !== rows.length) {
  throw new Error(`件数または一意性の検証失敗: collected=${rows.length}, expected=${expectedCollected}`)
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ collected_at: new Date().toISOString(), official_total: expectedTotal, collected: rows.length, rows }, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, total: rows.length, first: rows.slice(0, 10), last: rows.slice(-3) }, null, 2))
