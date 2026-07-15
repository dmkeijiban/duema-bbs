#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase service role環境変数が必要です')
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function allRows(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const cards = await allRows('cards', 'id,name,normalized_name,name_kana,image_url,is_catalog_complete,catalog_review_status')
const printings = await allRows('card_printings', 'id,card_id,source_key,official_page_url,image_url,is_representative')
const countDuplicates = (values) => values.length - new Set(values).size
const representatives = new Map()
for (const row of printings) if (row.is_representative) representatives.set(row.card_id, (representatives.get(row.card_id) ?? 0) + 1)
const officialPage = /^https:\/\/dm\.takaratomy\.co\.jp\/card\/detail\/\?id=/
const officialImage = /^https:\/\/dm\.takaratomy\.co\.jp\/wp-content\/(card\/cardimage\/|card\/cardthumb\/|themes\/dm2019\/img\/product\/)/

console.log(JSON.stringify({
  cards: cards.length,
  printings: printings.length,
  duplicateNormalizedNames: countDuplicates(cards.map((row) => row.normalized_name)),
  duplicateSourceKeys: countDuplicates(printings.map((row) => row.source_key)),
  missingCardNames: cards.filter((row) => !row.name?.trim()).length,
  missingNameKana: cards.filter((row) => !row.name_kana?.trim()).length,
  missingPrintingImageUrls: printings.filter((row) => !row.image_url?.trim()).length,
  invalidOfficialPageUrls: printings.filter((row) => !officialPage.test(row.official_page_url ?? '')).length,
  invalidOfficialImageUrls: printings.filter((row) => !officialImage.test(row.image_url ?? '')).length,
  cardsWithoutRepresentative: new Set(printings.map((row) => row.card_id)).size - representatives.size,
  cardsWithMultipleRepresentatives: [...representatives.values()].filter((count) => count > 1).length,
  incompleteCards: cards.filter((row) => !row.is_catalog_complete).length,
  needsReviewCards: cards.filter((row) => row.catalog_review_status === 'needs_review').length,
}, null, 2))
