#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.split('=')
  return [key, value.join('=') || true]
}))
const inputPath = resolve(String(args.get('--input') ?? 'data/cards/card-printings.json'))
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/card-faces.checkpoint.json'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/card-faces.json'))
const matchesPath = resolve(String(args.get('--matches') ?? 'data/cards/dm26-ex2-preview-official-matches.json'))
const officialPath = resolve(String(args.get('--official') ?? 'data/cards/dm26-ex2-official.json'))
const execute = args.has('--execute')

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const saveJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporaryPath, path)
}
const isPreviewKey = (value) => /^DM26EX2-PREVIEW-/i.test(value ?? '')

const [input, checkpoint, matches, official] = await Promise.all([
  readJson(inputPath), readJson(checkpointPath), readJson(matchesPath), readJson(officialPath),
])
if (!Array.isArray(input) || !checkpoint?.items || !Array.isArray(matches) || !Array.isArray(official)) {
  throw new Error('入力artifactの形式が不正です')
}
if (matches.length !== 154 || official.length !== 154) throw new Error('DM26-EX2 artifactは154件である必要があります')
const matched = matches.filter((row) => row.status === 'matched')
const officialOnly = matches.filter((row) => row.status === 'official_only')
if (matched.length !== 149 || officialOnly.length !== 5) throw new Error('DM26-EX2対応はmatched 149 / official_only 5である必要があります')

const officialKeys = new Set(official.map((row) => row.source_key))
const officialRows = input.filter((row) => officialKeys.has(row.source_key))
const previewRows = input.filter((row) => isPreviewKey(row.source_key))
if (previewRows.length) throw new Error(`最新DB exportにpreview keyが${previewRows.length}件残っています`)
if (officialRows.length !== 154 || new Set(officialRows.map((row) => row.source_key)).size !== 154) {
  throw new Error(`最新DB exportの正式DM26-EX2収録版が154件ではありません: ${officialRows.length}`)
}

const staleEntries = Object.entries(checkpoint.items).filter(([, page]) =>
  isPreviewKey(page?.source_key)
  || (page?.printings ?? []).some((printing) => isPreviewKey(printing?.source_key))
  || page?.official_page_url === 'https://dm.takaratomy.co.jp/product/dm26ex2/'
)
const officialEntries = Object.values(checkpoint.items).filter((page) => officialKeys.has(page?.source_key))
const officialPrintingIds = new Set(officialRows.map((row) => row.id))
const officialFacePairs = new Set(officialEntries.flatMap((page) =>
  (page.printings ?? []).filter((printing) => officialPrintingIds.has(printing.id)).flatMap((printing) =>
    (page.faces ?? []).map((face) => `${printing.id}:${face.side_index}`)
  )
))
const duplicateFacePairs = [...officialEntries.flatMap((page) =>
  (page.printings ?? []).filter((printing) => officialPrintingIds.has(printing.id)).flatMap((printing) =>
    (page.faces ?? []).map((face) => `${printing.id}:${face.side_index}`)
  ))].length - officialFacePairs.size

if (execute) {
  for (const [key] of staleEntries) delete checkpoint.items[key]
  checkpoint.updated_at = new Date().toISOString()
  const pages = Object.values(checkpoint.items).filter((page) => ['success', 'not_modified'].includes(page.status))
  const faces = pages.flatMap((page) => (page.printings ?? []).flatMap((printing) => (page.faces ?? []).map((face) => ({
    card_id: printing.card_id,
    card_printing_id: printing.id,
    ...face,
    extracted_at: page.checked_at,
  }))))
  await saveJson(checkpointPath, checkpoint)
  await saveJson(outputPath, { generated_at: new Date().toISOString(), pages, faces })
}

console.log(JSON.stringify({
  mode: execute ? 'execute' : 'dry-run',
  official_input_rows: officialRows.length,
  preview_input_rows: previewRows.length,
  stale_checkpoint_entries: staleEntries.length,
  official_checkpoint_entries: officialEntries.length,
  official_checkpoint_remaining: 154 - officialEntries.length,
  duplicate_official_face_pairs: duplicateFacePairs,
}, null, 2))
