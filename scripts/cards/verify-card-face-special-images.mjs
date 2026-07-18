#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const inputPath = resolve(process.argv.find((value) => value.startsWith('--input='))?.slice(8) ?? 'data/cards/card-face-exception-review.json')
const outputPath = resolve(process.argv.find((value) => value.startsWith('--report='))?.slice(9) ?? 'data/cards/card-face-special-image-verification.json')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const urls = [...new Set((input.three_and_four_face_printings ?? []).flatMap((printing) => printing.faces.map((face) => face.image_url)))]
const results = []
for (const url of urls) {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'duema-bbs-card-face-audit/1.0' } })
    results.push({ image_url: url, status: response.status, ok: response.status === 200 || response.status === 206, content_type: response.headers.get('content-type') })
  } catch (error) {
    results.push({ image_url: url, status: null, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
}
const report = { generated_at: new Date().toISOString(), checked: results.length, ok: results.every((row) => row.ok && /^image\//.test(row.content_type ?? '')), failures: results.filter((row) => !row.ok), results }
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ report: outputPath, checked: report.checked, failures: report.failures.length, ok: report.ok }, null, 2))
if (!report.ok) process.exitCode = 1
