#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { normalizeCardName } from './card-face-extraction.mjs'

const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.split('='); return [key, value.join('=') || true] }))
const checkpointPath = resolve(String(args.get('--checkpoint') ?? 'data/cards/card-faces.checkpoint.json'))
const outputPath = resolve(String(args.get('--output') ?? 'data/cards/card-faces.json'))
const overridesPath = resolve(String(args.get('--overrides') ?? 'data/cards/card-face-manual-overrides.json'))
const execute = args.has('--execute')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const saveJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporaryPath, path)
}
const [checkpoint, overrides] = await Promise.all([readJson(checkpointPath), readJson(overridesPath)])
let changed = 0
for (const override of overrides) {
  const page = Object.values(checkpoint.items).find((item) => item.source_key === override.source_key)
  const face = page?.faces?.find((item) => item.side_index === override.side_index)
  if (!face) throw new Error(`override対象がありません: ${override.source_key}:${override.side_index}`)
  if (face.name !== override.name || face.extraction_status === 'needs_review') changed += 1
  if (execute) {
    face.name = override.name
    face.normalized_name = normalizeCardName(override.name)
    face.extraction_status = face.name_kana ? 'complete' : 'name_kana_pending'
    face.manual_override = { reason: override.reason }
  }
}
if (execute) {
  checkpoint.updated_at = new Date().toISOString()
  const pages = Object.values(checkpoint.items).filter((page) => ['success', 'not_modified'].includes(page.status))
  const faces = pages.flatMap((page) => (page.printings ?? []).flatMap((printing) => (page.faces ?? []).map((face) => ({
    card_id: printing.card_id, card_printing_id: printing.id, ...face, extracted_at: page.checked_at,
  }))))
  await saveJson(checkpointPath, checkpoint)
  await saveJson(outputPath, { generated_at: new Date().toISOString(), pages, faces })
}
console.log(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', overrides: overrides.length, changed }, null, 2))
