#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const execute = process.argv.includes('--execute')
if (execute && !process.argv.includes('--confirm=IMPORT_CARD_CATALOG')) throw new Error('本番投入には --execute --confirm=IMPORT_CARD_CATALOG が必要です')
const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/official-catalog.json'

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase service role環境変数が必要です')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const catalog = JSON.parse(await readFile(input, 'utf8'))
const normalize = (value) => value.normalize('NFKC').trim().replace(/[\s\u3000]+/g, '').replace(/[／∕]/g, '/').replace(/[・·]/g, '・')
const chunks = (items, size = 250) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

async function allRows(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const beforeCards = await allRows('cards', 'id,name,normalized_name,name_kana,image_url,civilization,cost,card_type,is_catalog_complete,catalog_review_status')
const beforePrintings = await allRows('card_printings', 'source_key,card_id,is_representative')
const byName = new Map(beforeCards.map((row) => [row.normalized_name, row]))
const grouped = new Map()
for (const printing of catalog) {
  const normalized = normalize(printing.name)
  if (!grouped.has(normalized)) grouped.set(normalized, [])
  grouped.get(normalized).push(printing)
}

const newCards = []
const nullOnlyUpdates = []
for (const [normalizedName, printings] of grouped) {
  const representative = printings[0]
  const values = { name: representative.name, normalized_name: normalizedName, name_kana: representative.name_kana, image_url: representative.image_url, civilization: representative.civilization?.split('/').filter(Boolean) ?? [], cost: /^\d+$/.test(representative.cost ?? '') ? Number(representative.cost) : null, card_type: representative.card_type, regulation: 'none', is_active: true, is_catalog_complete: Boolean(representative.name && representative.image_url), catalog_review_status: representative.name && representative.image_url ? 'complete' : 'needs_review' }
  const existing = byName.get(normalizedName)
  if (!existing) newCards.push(values)
  else {
    const patch = {}
    for (const field of ['name_kana', 'image_url', 'cost', 'card_type']) if (existing[field] == null && values[field] != null) patch[field] = values[field]
    if ((!existing.civilization || existing.civilization.length === 0) && values.civilization.length) patch.civilization = values.civilization
    if (Object.keys(patch).length) nullOnlyUpdates.push({ id: existing.id, patch })
  }
}

const summary = { mode: execute ? 'execute' : 'dry-run', input: catalog.length, uniqueNames: grouped.size, cardsBefore: beforeCards.length, printingsBefore: beforePrintings.length, newCards: newCards.length, nullOnlyUpdates: nullOnlyUpdates.length, existingValuesOverwritten: 0 }
if (!execute) { console.log(JSON.stringify(summary, null, 2)); process.exit(0) }

for (const batch of chunks(newCards)) { const { error } = await supabase.from('cards').insert(batch); if (error) throw error }
for (const item of nullOnlyUpdates) { const { error } = await supabase.from('cards').update(item.patch).eq('id', item.id); if (error) throw error }
const cardsAfterInsert = await allRows('cards', 'id,normalized_name')
const ids = new Map(cardsAfterInsert.map((row) => [row.normalized_name, row.id]))
const existingSources = new Set(beforePrintings.map((row) => row.source_key))
const existingBySource = new Map(beforePrintings.map((row) => [row.source_key, row]))
const hasRepresentative = new Set(beforePrintings.filter((row) => row.is_representative).map((row) => row.card_id))
const printingRows = []
for (const [normalizedName, printings] of grouped) {
  const cardId = ids.get(normalizedName)
  if (!cardId) throw new Error(`card_id解決失敗: ${normalizedName}`)
  let representativeAssigned = hasRepresentative.has(cardId)
  for (const printing of printings) {
    const previous = existingBySource.get(printing.source_key)
    printingRows.push({ card_id: cardId, source_key: printing.source_key, official_page_url: printing.official_page_url, image_url: printing.image_url, set_name: printing.set_name, card_number: printing.card_number, is_representative: previous?.is_representative ?? !representativeAssigned })
    representativeAssigned = true
  }
}
for (const batch of chunks(printingRows)) { const { error } = await supabase.from('card_printings').upsert(batch, { onConflict: 'source_key' }); if (error) throw error }
const afterCards = await allRows('cards', 'id,normalized_name')
const afterPrintings = await allRows('card_printings', 'source_key,card_id')
console.log(JSON.stringify({ ...summary, cardsAfter: afterCards.length, printingsAfter: afterPrintings.length, insertedPrintings: printingRows.filter((row) => !existingSources.has(row.source_key)).length }, null, 2))
