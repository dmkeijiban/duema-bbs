#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const inputPath = resolve(process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/card-faces.json')
const printingsPath = resolve(process.argv.find((arg) => arg.startsWith('--printings='))?.slice(12) ?? 'data/cards/card-printings.json')
const reportPath = resolve(process.argv.find((arg) => arg.startsWith('--report='))?.slice(9) ?? 'data/cards/card-faces.validation.json')
const payload = JSON.parse(await readFile(inputPath, 'utf8'))
const printings = JSON.parse(await readFile(printingsPath, 'utf8'))
const faces = Array.isArray(payload.faces) ? payload.faces : []
const printingIds = new Set(printings.map((row) => row.id))
const cardIds = new Set(printings.map((row) => row.card_id))
const keys = faces.map((face) => `${face.card_printing_id}:${face.side_index}`)
const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
const grouped = new Map()
for (const face of faces) grouped.set(face.card_printing_id, [...(grouped.get(face.card_printing_id) ?? []), face])
const multiFace = [...grouped.values()].filter((items) => items.length >= 2)
const rearNames = multiFace.flatMap((items) => items.filter((face) => face.side_index > 0).map((face) => face.normalized_name))
const report = {
  generated_at: new Date().toISOString(),
  totals: { faces: faces.length, printings_with_faces: grouped.size, multi_face_printings: multiFace.length, three_plus_face_printings: [...grouped.values()].filter((items) => items.length >= 3).length, unique_rear_names: new Set(rearNames).size },
  errors: { missing_name: faces.filter((face) => !face.name?.trim()).length, duplicate_printing_side: new Set(duplicates).size, orphan_card_id: faces.filter((face) => !cardIds.has(face.card_id)).length, orphan_card_printing_id: faces.filter((face) => !printingIds.has(face.card_printing_id)).length },
  warnings: { missing_image_url: faces.filter((face) => !face.image_url).length, missing_official_page_url: faces.filter((face) => !face.official_page_url).length, same_name_front_back: multiFace.filter((items) => new Set(items.map((face) => face.normalized_name)).size < items.length).map((items) => items[0].card_printing_id) },
}
report.ok = Object.values(report.errors).every((count) => count === 0)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
