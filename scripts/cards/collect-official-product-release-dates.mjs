#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/official-card-order.json'
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'data/cards/official-product-release-dates.json'
const order = JSON.parse(await readFile(input, 'utf8'))
const setCodes = [...new Set(order.rows.map((row) => row.source_key.split('-')[0].toLowerCase()))]
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
let rows = []
try { rows = JSON.parse(await readFile(output, 'utf8')).rows ?? [] } catch {}
const completed = new Set(rows.map((row) => row.set_code))

for (let index = 0; index < setCodes.length; index += 1) {
  const set_code = setCodes[index]
  if (completed.has(set_code)) continue
  if (rows.length > 0) await sleep(1_100)
  const url = `https://dm.takaratomy.co.jp/product/${encodeURIComponent(set_code)}/`
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'DuemaBBSCardOrderVerifier/1.0 (+https://www.duema-bbs.com/contact)' } })
  if (response.status === 403 || response.status === 429) throw new Error(`${response.status}を検出したため停止`)
  if (new URL(response.url).origin !== 'https://dm.takaratomy.co.jp') throw new Error(`外部リダイレクトを検出したため停止: ${response.url}`)
  let release_date = null
  if (response.ok) {
    const html = await response.text()
    const match = html.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/)
    if (match) release_date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  } else if (response.status !== 404) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }
  rows.push({ set_code, release_date, status: response.status })
  await writeFile(output, `${JSON.stringify({ collected_at: new Date().toISOString(), total_set_codes: rows.length, dated_set_codes: rows.filter((row) => row.release_date).length, rows }, null, 2)}\n`)
  if (rows.length % 25 === 0) console.log(JSON.stringify({ checked: rows.length, total: setCodes.length, dated: rows.filter((row) => row.release_date).length }))
}

await writeFile(output, `${JSON.stringify({ collected_at: new Date().toISOString(), total_set_codes: rows.length, dated_set_codes: rows.filter((row) => row.release_date).length, rows }, null, 2)}\n`)
console.log(JSON.stringify({ output, total: rows.length, dated: rows.filter((row) => row.release_date).length, null: rows.filter((row) => !row.release_date).length }))
