#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const matches = JSON.parse(await readFile('data/cards/dm26-ex2-preview-official-matches.json', 'utf8'))
const official = JSON.parse(await readFile('data/cards/dm26-ex2-official.json', 'utf8'))
const matched = matches.filter((row) => row.status === 'matched')
const officialOnly = matches.filter((row) => row.status === 'official_only')
const duplicates = (values) => values.length - new Set(values).size
const normalizeLoose = (value) => value.normalize('NFKC').replace(/[\s\u3000・／/]/g, '').toLowerCase()
const differences = matched.filter((row) => normalizeLoose(row.previewName) !== normalizeLoose(row.officialName)).map((row) => ({
  previewSourceKey: row.previewSourceKey,
  officialSourceKey: row.officialSourceKey,
  cardId: row.cardId,
  cardNumber: row.cardNumber,
  previewName: row.previewName,
  officialName: row.officialName,
  category: /[／/]/.test(row.previewName) || /[／/]/.test(row.officialName) ? 'twinpact_or_slash_notation' : 'official_spelling_correction',
  sameCardConfirmedBy: row.matchMethod,
}))
const report = {
  generatedAt: new Date().toISOString(),
  matched: matched.length,
  officialOnly: officialOnly.length,
  ambiguous: matches.filter((row) => row.status === 'ambiguous').length,
  previewOnly: matches.filter((row) => row.status === 'preview_only').length,
  duplicatePreviewSourceKeys: duplicates(matched.map((row) => row.previewSourceKey)),
  duplicateOfficialSourceKeys: duplicates(matches.map((row) => row.officialSourceKey)),
  missingCardIds: matches.filter((row) => !row.cardId).length,
  invalidMatchMethods: matched.filter((row) => !['card_number', 'card_number_and_normalized_name'].includes(row.matchMethod)).length,
  nonExactConfidence: matched.filter((row) => row.confidence !== 'exact').length,
  missingCardNumbers: matches.filter((row) => !row.cardNumber).length,
  missingPreviewImages: matched.filter((row) => !row.previewImageUrl).length,
  missingOfficialImages: matches.filter((row) => !row.officialImageUrl).length,
  officialOnlySourceKeys: officialOnly.map((row) => row.officialSourceKey),
  officialOnlyAreSprSecrets: officialOnly.every((row) => /^dm26ex2-SPRSEC\d{3}$/.test(row.officialSourceKey)),
  officialOnlyReuseExistingCardIds: new Set(officialOnly.map((row) => row.cardId)).size === 5 && officialOnly.every((row) => matched.some((match) => match.cardId === row.cardId)),
  officialLogicalCards: new Set(official.map((row) => row.name.normalize('NFKC').replace(/[\s\u3000]+/g, ''))).size,
  officialNameDifferences: differences.length,
  differences,
}
report.stopRequired = report.matched !== 149 || report.officialOnly !== 5 || report.ambiguous || report.previewOnly || report.duplicatePreviewSourceKeys || report.duplicateOfficialSourceKeys || report.missingCardIds || report.invalidMatchMethods || report.nonExactConfidence || report.missingCardNumbers || report.missingPreviewImages || report.missingOfficialImages || !report.officialOnlyAreSprSecrets || !report.officialOnlyReuseExistingCardIds || report.officialLogicalCards !== 134 || report.officialNameDifferences !== 23
await writeFile('data/cards/dm26-ex2-artifact-review.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (report.stopRequired) process.exitCode = 1
