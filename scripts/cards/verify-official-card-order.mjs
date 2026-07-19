#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/official-card-order.json'
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'data/cards/official-card-order-verification.json'
const official = JSON.parse(await readFile(input, 'utf8'))
let printings
if (process.env.SUPABASE_DB_URL && process.env.FORCE_SUPABASE_API !== '1') {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    printings = (await client.query(`select p.id,p.card_id,p.source_key,p.set_name,p.card_number,p.image_url,p.is_search_visible,c.name
      from public.card_printings p join public.cards c on c.id=p.card_id order by p.id`)).rows.map((row) => ({ ...row, cards: { name: row.name } }))
  } finally {
    await client.end()
  }
} else {
  if (!url || !key) throw new Error('Supabase環境変数が必要です')
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  printings = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('card_printings').select('id,card_id,source_key,set_name,card_number,image_url,is_search_visible,cards(name)').range(from, from + 999)
    if (error) throw error
    printings.push(...data)
    if (data.length < 1000) break
  }
}
const bySource = new Map(printings.map((row) => [row.source_key, row]))
const officialSources = new Set(official.rows.map((row) => row.source_key))
const matched = official.rows.flatMap((item) => {
  const printing = bySource.get(item.source_key)
  if (!printing || !printing.is_search_visible) return []
  const card = Array.isArray(printing.cards) ? printing.cards[0] : printing.cards
  return [{ ...item, printing_id: printing.id, card_id: printing.card_id, name: card?.name ?? null, set_name: printing.set_name, card_number: printing.card_number, image_url: printing.image_url }]
})
const missingOfficial = official.rows.filter((item) => !bySource.has(item.source_key)).map((item) => item.source_key)
const visibleNotOfficial = printings.filter((item) => item.is_search_visible && !officialSources.has(item.source_key)).map((item) => item.source_key)
const report = {
  official_total: official.official_total,
  database_printings: printings.length,
  matched: matched.length,
  missing_official_count: missingOfficial.length,
  missing_official: missingOfficial,
  visible_not_official_count: visibleNotOfficial.length,
  visible_not_official: visibleNotOfficial,
  first_48: matched.slice(0, 48),
}
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, first_48: undefined, missing_official: missingOfficial.slice(0, 30), visible_not_official: visibleNotOfficial.slice(0, 30) }, null, 2))
