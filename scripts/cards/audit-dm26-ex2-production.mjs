#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase環境変数が必要です')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const matches = JSON.parse(await readFile('data/cards/dm26-ex2-preview-official-matches.json', 'utf8'))
const normalizeName = (value) => value.normalize('NFKC').trim().replace(/[\s\u3000]+/g, '').replace(/[／∕]/g, '/').replace(/[・·]/g, '・')
const previewKeys = matches.filter((row) => row.previewSourceKey).map((row) => row.previewSourceKey)
const officialKeys = matches.filter((row) => row.officialSourceKey).map((row) => row.officialSourceKey)

async function selectIn(table, columns, column, values) {
  const rows = []
  for (let index = 0; index < values.length; index += 20) {
    const { data, error } = await supabase.from(table).select(columns).in(column, values.slice(index, index + 20))
    if (error) throw error
    rows.push(...data)
  }
  return rows
}
const previewPrintings = await selectIn('card_printings', 'id,card_id,source_key,official_page_url,image_url,set_name,card_number,is_representative', 'source_key', previewKeys)
const officialPrintings = await selectIn('card_printings', 'id,card_id,source_key,official_page_url,image_url,set_name,card_number,is_representative', 'source_key', officialKeys)
const cardIds = [...new Set([...previewPrintings, ...officialPrintings].map((row) => row.card_id))]
const cards = cardIds.length ? await selectIn('cards', 'id,name,normalized_name,name_kana,image_url,civilization,cost,card_type,source_kind,source_key,is_active', 'id', cardIds) : []
const previewPrintingByKey = new Map(previewPrintings.map((row) => [row.source_key, row]))
const cardsByNormalizedName = new Map(cards.map((row) => [row.normalized_name, row]))
for (const match of matches) {
  const card = match.previewSourceKey
    ? cards.find((row) => row.id === previewPrintingByKey.get(match.previewSourceKey)?.card_id)
    : cardsByNormalizedName.get(normalizeName(match.officialName))
  match.cardId = card?.id ?? null
  match.previewNormalizedName = match.previewName ? normalizeName(match.previewName) : null
  match.officialNormalizedName = match.officialName ? normalizeName(match.officialName) : null
}
if (matches.some((match) => !match.cardId)) throw new Error('照合JSONのcardId補完に失敗しました')
const officialNormalizedNames = [...new Set(matches.map((match) => match.officialNormalizedName))]
const cardsWithOfficialNames = await selectIn('cards', 'id,name,normalized_name,is_active,source_kind,source_key', 'normalized_name', officialNormalizedNames)
const affectedCardIds = new Set(matches.map((match) => match.cardId))
const officialNameCollisions = cardsWithOfficialNames
  .filter((row) => !affectedCardIds.has(row.id))
  .map((row) => ({
    officialNormalizedName: row.normalized_name,
    existingCardId: row.id,
    existingName: row.name,
    existingIsActive: row.is_active,
    existingSourceKind: row.source_kind,
    existingSourceKey: row.source_key,
    affectedCardIds: [...new Set(matches.filter((match) => match.officialNormalizedName === row.normalized_name).map((match) => match.cardId))],
  }))
await writeFile('data/cards/dm26-ex2-preview-official-matches.json', `${JSON.stringify(matches, null, 2)}\n`)
const projectResult = await supabase.from('maker_projects').select('id,slug').eq('slug', 'dm26-ex2-charisma-best-tier').maybeSingle()
if (projectResult.error) throw projectResult.error
let projectLinks = []
if (projectResult.data) {
  const result = await supabase.from('maker_project_cards').select('card_id,sort_order').eq('project_id', projectResult.data.id).order('sort_order')
  if (result.error) throw result.error
  projectLinks = result.data
}
let faceRows = []
let cardFacesTable = true
if (previewPrintings.length || officialPrintings.length) {
  const result = await supabase.from('card_faces').select('*').in('printing_id', [...previewPrintings, ...officialPrintings].map((row) => row.id))
  if (result.error?.code === 'PGRST205' || result.error?.code === '42P01') cardFacesTable = false
  else if (result.error) throw result.error
  else faceRows = result.data
}
const previewCardIds = new Set(previewPrintings.map((row) => row.card_id))
const officialCardIds = new Set(officialPrintings.map((row) => row.card_id))
const report = {
  generatedAt: new Date().toISOString(), readOnly: true,
  previewPrintings: previewPrintings.length, officialPrintingsAlreadyPresent: officialPrintings.length,
  previewLogicalCards: previewCardIds.size, officialLogicalCardsAlreadyPresent: officialCardIds.size,
  previewAndOfficialSameCardIds: [...previewCardIds].filter((id) => officialCardIds.has(id)).length,
  duplicatePreviewSourceKeys: previewPrintings.length - new Set(previewPrintings.map((row) => row.source_key)).size,
  duplicateOfficialSourceKeys: officialPrintings.length - new Set(officialPrintings.map((row) => row.source_key)).size,
  cards: cards.length, cardsMissingNameKana: cards.filter((row) => !row.name_kana).length,
  officialNameCollisionCount: officialNameCollisions.length, officialNameCollisions,
  makerProjectLinks: projectLinks.length, makerProjectLinkedPreviewCards: projectLinks.filter((row) => previewCardIds.has(row.card_id)).length,
  makerProjectFirst32CardIds: projectLinks.slice(0, 32).map((row) => row.card_id),
  cardFacesTable, affectedCardFaces: faceRows.length,
  previewOfficialPageProductUrls: previewPrintings.filter((row) => /\/product\/dm26ex2\//.test(row.official_page_url ?? '')).length,
  previewImageUrls: previewPrintings.filter((row) => /\/product\/dm26ex2\/all-precedence\//.test(row.image_url ?? '')).length,
}
await writeFile('data/cards/dm26-ex2-production-audit.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
