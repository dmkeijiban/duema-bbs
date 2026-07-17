#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { classifyFailure, contentHash, extractOfficialCardFaces, OFFICIAL_DETAIL_URL, PARSER_VERSION } from './card-face-extraction.mjs'

const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.split('='); return [key, value.join('=') || true] }))
const inputPath = resolve(String(args.get('--input') ?? 'data/cards/card-printings.json'))
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/card-faces.checkpoint.json'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/card-faces.json'))
const cacheDir = resolve(String(args.get('--cache-dir') ?? 'data/cards/official-html-cache'))
const maxItems = Number(args.get('--max-items') ?? 3)
const execute = args.has('--execute')
const cacheOnly = args.has('--cache-only')
const forceKeys = new Set(String(args.get('--force') ?? '').split(',').filter(Boolean))
const MIN_INTERVAL_MS = 1_100
const MAX_ATTEMPTS = 4
let lastFetchAt = 0

const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, 'utf8')) } catch { return fallback } }
const saveJson = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`) }
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const cachePath = (sourceKey) => resolve(cacheDir, `${sourceKey.replace(/[^a-z0-9_-]/gi, '_')}.html`)

if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', inputPath, checkpointPath, outputPath, cacheDir, maxItems, minIntervalMs: MIN_INTERVAL_MS, maxAttempts: MAX_ATTEMPTS }, null, 2))
  process.exit(0)
}
if (!Number.isInteger(maxItems) || maxItems < 1) throw new Error('--max-itemsは1以上の整数が必要です')

const printings = await readJson(inputPath, null)
if (!Array.isArray(printings)) throw new Error(`入力JSONが配列ではありません: ${inputPath}`)
const checkpoint = await readJson(checkpointPath, { version: 1, items: {}, updated_at: null })
const byUrl = new Map()
for (const row of printings) {
  if (!row?.source_key || !row?.official_page_url) continue
  const group = byUrl.get(row.official_page_url) ?? []
  group.push(row)
  byUrl.set(row.official_page_url, group)
}

const candidates = [...byUrl.entries()].filter(([url, rows]) => {
  const previous = checkpoint.items[rows[0].source_key]
  return forceKeys.has(rows[0].source_key) || !previous || !['success', 'not_modified'].includes(previous.status) || previous.official_page_url !== url || previous.parser_version !== PARSER_VERSION
}).slice(0, maxItems)

for (const [officialPageUrl, rows] of candidates) {
  const sourceKey = rows[0].source_key
  const previous = checkpoint.items[sourceKey]
  const base = { source_key: sourceKey, official_page_url: officialPageUrl, attempts: previous?.attempts ?? 0, checked_at: new Date().toISOString() }
  if (!OFFICIAL_DETAIL_URL.test(officialPageUrl)) {
    checkpoint.items[sourceKey] = { ...base, status: 'nonstandard_url', last_error: 'nonstandard official_page_url', extracted_face_count: 0 }
    await saveJson(checkpointPath, checkpoint)
    continue
  }

  let html = null
  let cacheUsed = false
  let responseStatus = 0
  let lastError = null
  const cachedHtml = await readFile(cachePath(sourceKey), 'utf8').catch(() => null)
  if (cachedHtml && !forceKeys.has(sourceKey)) { html = cachedHtml; cacheUsed = true }
  if (cacheOnly && !html) continue
  for (let attempt = 1; !html && attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastFetchAt))
      if (wait) await sleep(wait)
      lastFetchAt = Date.now()
      const response = await fetch(officialPageUrl, { redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'DuemaBBSCardFaceImporter/1.0 (+https://www.duema-bbs.com/contact)' } })
      responseStatus = response.status
      base.attempts += 1
      if (response.status === 429) throw Object.assign(new Error('429 rate limited; run stopped'), { stop: true })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      html = await response.text()
    } catch (error) {
      lastError = error
      if (error.stop || responseStatus === 404 || attempt === MAX_ATTEMPTS) break
      await sleep(Math.min(30_000, 1_000 * (2 ** attempt)))
    }
  }

  if (!html) {
    checkpoint.items[sourceKey] = { ...base, status: classifyFailure(responseStatus, lastError), last_error: lastError?.message ?? 'fetch failed', extracted_face_count: 0 }
    await saveJson(checkpointPath, checkpoint)
    if (responseStatus === 429) throw lastError
    continue
  }

  await mkdir(cacheDir, { recursive: true })
  await writeFile(cachePath(sourceKey), html)
  const hash = contentHash(html)
  if (previous?.content_hash === hash && previous?.status === 'success' && previous?.parser_version === PARSER_VERSION && !forceKeys.has(sourceKey)) {
    checkpoint.items[sourceKey] = { ...previous, ...base, status: 'not_modified', cache_used: cacheUsed, parser_version: PARSER_VERSION }
    await saveJson(checkpointPath, checkpoint)
    continue
  }
  const faces = extractOfficialCardFaces(html, officialPageUrl)
  if (!faces.length) {
    checkpoint.items[sourceKey] = { ...base, status: 'parse_failed', last_error: 'cardDetail not found', content_hash: hash, extracted_face_count: 0, cache_used: cacheUsed, parser_version: PARSER_VERSION }
  } else {
    checkpoint.items[sourceKey] = {
      ...base, status: 'success', last_error: null, content_hash: hash, extracted_face_count: faces.length, faces, cache_used: cacheUsed, parser_version: PARSER_VERSION,
      printings: rows.map((row) => ({ id: row.id ?? null, card_id: row.card_id ?? null, source_key: row.source_key })),
    }
  }
  checkpoint.updated_at = new Date().toISOString()
  await saveJson(checkpointPath, checkpoint)
}

const results = Object.values(checkpoint.items).filter((item) => item.status === 'success' || item.status === 'not_modified')
const faceRows = results.flatMap((page) => (page.printings ?? []).flatMap((printing) => (page.faces ?? []).map((face) => ({
  card_id: printing.card_id,
  card_printing_id: printing.id,
  ...face,
  extracted_at: page.checked_at,
}))))
await saveJson(outputPath, { generated_at: new Date().toISOString(), pages: results, faces: faceRows })
const statuses = Object.values(checkpoint.items).reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), {})
console.log(JSON.stringify({ unique_urls: byUrl.size, processed_this_run: candidates.length, checkpoint_items: Object.keys(checkpoint.items).length, statuses, outputPath, checkpointPath }, null, 2))
