#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const label = process.env.DM26_ENV_LABEL ?? 'unknown'
if (!url || !key) throw new Error('Supabase環境変数が必要です')
const supabase = createClient(url, key, { auth: { persistSession: false } })
async function all(table, columns) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(offset, offset + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
const [cards, printings, aliases, projects] = await Promise.all([
  all('cards', 'id,name,normalized_name'),
  all('card_printings', 'id,card_id,source_key,official_page_url,image_url,card_number,is_search_visible,source_status'),
  all('card_printing_source_aliases', 'old_source_key,printing_id,official_source_key'),
  supabase.from('maker_projects').select('id,slug').eq('slug', 'dm26-ex2-charisma-best-tier'),
])
if (projects.error) throw projects.error
const project = projects.data?.[0]
const linksResult = project ? await supabase.from('maker_project_cards').select('card_id,sort_order').eq('project_id', project.id).order('sort_order') : { data: [], error: null }
if (linksResult.error) throw linksResult.error
const dmPrintings = printings.filter((row) => /^dm26ex2-/i.test(row.source_key))
const dmCardIds = new Set(dmPrintings.map((row) => row.card_id))
const dmCards = cards.filter((row) => dmCardIds.has(row.id))
const duplicate = (values) => values.length - new Set(values).size
const report = {
  generatedAt: new Date().toISOString(), environment: label,
  allCards: cards.length, allPrintings: printings.length,
  officialPrintings: dmPrintings.length, logicalCards: dmCardIds.size,
  previewSourceKeysRemaining: printings.filter((row) => /^DM26EX2-PREVIEW-/.test(row.source_key)).length,
  aliases: aliases.filter((row) => /^DM26EX2-PREVIEW-/.test(row.old_source_key)).length,
  officialOnlySprSecrets: dmPrintings.filter((row) => /^dm26ex2-SPRSEC\d{3}$/i.test(row.source_key)).length,
  duplicateSourceKeys: duplicate(printings.map((row) => row.source_key)),
  duplicateNormalizedNames: duplicate(cards.map((row) => row.normalized_name)),
  missingImages: dmPrintings.filter((row) => !row.image_url).length,
  missingOfficialPages: dmPrintings.filter((row) => !row.official_page_url).length,
  hiddenOfficialPrintings: dmPrintings.filter((row) => !row.is_search_visible).length,
  nonOfficialStatuses: dmPrintings.filter((row) => row.source_status !== 'official').length,
  orphanPrintings: printings.filter((row) => !cards.some((card) => card.id === row.card_id)).length,
  orphanAliases: aliases.filter((row) => !printings.some((printing) => printing.id === row.printing_id)).length,
  makerProjectLinks: linksResult.data?.length ?? 0,
  makerProjectLinksToDm26: (linksResult.data ?? []).filter((row) => dmCardIds.has(row.card_id)).length,
  makerProjectLinksOutsideDm26: (linksResult.data ?? []).filter((row) => !dmCardIds.has(row.card_id)).map((row) => ({ sortOrder: row.sort_order, card: cards.find((card) => card.id === row.card_id) ?? null })),
  officialNamesApplied: dmCards.filter((card) => !/水雲 フカフチノカミ|風神 ミッツノクエビコ|断罪のロスト・ソーン/.test(card.name)).length === dmCards.length,
}
report.stopRequired = report.officialPrintings !== 154 || report.logicalCards !== 134 || report.previewSourceKeysRemaining !== 0 || report.aliases !== 149 || report.officialOnlySprSecrets !== 5 || report.duplicateSourceKeys || report.duplicateNormalizedNames || report.missingImages || report.missingOfficialPages || report.hiddenOfficialPrintings || report.nonOfficialStatuses || report.orphanPrintings || report.orphanAliases || report.makerProjectLinks !== 94 || report.makerProjectLinksToDm26 !== 94 || !report.officialNamesApplied
const output = `data/cards/dm26-ex2-${label}-database-verification.json`
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (report.stopRequired) process.exitCode = 1
