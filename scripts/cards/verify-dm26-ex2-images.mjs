#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import sharp from 'sharp'

const catalog = JSON.parse(await readFile('data/cards/dm26-ex2-official.json', 'utf8'))
const output = 'data/cards/dm26-ex2-image-verification.json'
let checkpoint
try { checkpoint = JSON.parse(await readFile(output, 'utf8')) } catch { checkpoint = { results: [] } }
const known = new Map(checkpoint.results.map((row) => [row.url, row]))
const targets = [...new Map(catalog.flatMap((card) => [
  [card.image_url, { url: card.image_url, kind: 'image', sourceKey: card.source_key }],
  [card.thumbnail_url, { url: card.thumbnail_url, kind: 'thumbnail', sourceKey: card.source_key }],
])).values()]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let lastRequest = 0
for (const target of targets) {
  if (known.has(target.url)) continue
  const wait = Math.max(0, 1100 - (Date.now() - lastRequest))
  if (wait) await sleep(wait)
  lastRequest = Date.now()
  let result
  try {
    const response = await fetch(target.url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'DuemaBBSCardImporter/1.0 (+https://www.duema-bbs.com/contact)' } })
    const buffer = Buffer.from(await response.arrayBuffer())
    let metadata = null
    let decodeError = null
    try { metadata = await sharp(buffer).metadata() } catch (error) { decodeError = error instanceof Error ? error.message : String(error) }
    result = { ...target, status: response.status, contentType: response.headers.get('content-type'), bytes: buffer.length, width: metadata?.width ?? null, height: metadata?.height ?? null, decodeError, ok: response.status === 200 && /^image\//.test(response.headers.get('content-type') ?? '') && buffer.length > 5000 && (metadata?.width ?? 0) >= 100 && (metadata?.height ?? 0) >= 100 && !decodeError }
  } catch (error) {
    result = { ...target, status: null, contentType: null, bytes: 0, width: null, height: null, decodeError: error instanceof Error ? error.message : String(error), ok: false }
  }
  checkpoint.results.push(result)
  known.set(target.url, result)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(checkpoint, null, 2)}\n`)
}
const summary = {
  checkedUrls: checkpoint.results.length,
  officialImages: checkpoint.results.filter((row) => row.kind === 'image').length,
  thumbnails: checkpoint.results.filter((row) => row.kind === 'thumbnail').length,
  ok: checkpoint.results.filter((row) => row.ok).length,
  failed: checkpoint.results.filter((row) => !row.ok).length,
  statusCounts: Object.fromEntries([...new Set(checkpoint.results.map((row) => String(row.status)))].map((status) => [status, checkpoint.results.filter((row) => String(row.status) === status).length])),
  failures: checkpoint.results.filter((row) => !row.ok),
}
checkpoint.summary = summary
await writeFile(output, `${JSON.stringify(checkpoint, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
if (summary.failed) process.exitCode = 1
