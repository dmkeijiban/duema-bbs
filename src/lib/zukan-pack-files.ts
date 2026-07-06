import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { checkZukanImportDuplicates, parseZukanImportJson } from '@/lib/zukan-pack-import'
import { validateZukanPackData } from '@/lib/zukan-pack-validation'

const PACK_DATA_DIR = path.join(process.cwd(), 'data', 'zukan-packs')
const PACK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type ZukanPackFileOption = {
  slug: string
  fileName: string
  code: string | null
  name: string | null
  cardCount: number | null
  cardsLength: number | null
  isValid: boolean
  isDuplicateCheckDone: boolean
  isRegistered: boolean
  errors: string[]
  warnings: string[]
}

function isSafePackSlug(slug: string) {
  return PACK_SLUG_PATTERN.test(slug)
}

function dataPathForSlug(slug: string) {
  if (!isSafePackSlug(slug)) throw new Error('Invalid pack slug')
  return path.join(PACK_DATA_DIR, `${slug}.json`)
}

function toStringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function readZukanPackJsonFile(slug: string) {
  return readFile(dataPathForSlug(slug), 'utf8')
}

export async function listZukanPackFileOptions(): Promise<ZukanPackFileOption[]> {
  const entries = await readdir(PACK_DATA_DIR, { withFileTypes: true }).catch(() => [])
  const jsonFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const options = await Promise.all(jsonFiles.map(async fileName => {
    const slug = fileName.replace(/\.json$/, '')
    const errors: string[] = []
    const warnings: string[] = []

    if (!isSafePackSlug(slug)) {
      errors.push('[file] ファイル名に使えないslugです')
      return {
        slug,
        fileName,
        code: null,
        name: null,
        cardCount: null,
        cardsLength: null,
        isValid: false,
        isDuplicateCheckDone: false,
        isRegistered: false,
        errors,
        warnings,
      }
    }

    const json = await readZukanPackJsonFile(slug)
    const parsed = parseZukanImportJson(json)
    if (!parsed.data) {
      errors.push(parsed.error ?? 'JSON parse error')
      return {
        slug,
        fileName,
        code: null,
        name: null,
        cardCount: null,
        cardsLength: null,
        isValid: false,
        isDuplicateCheckDone: false,
        isRegistered: false,
        errors,
        warnings,
      }
    }

    const validation = validateZukanPackData(parsed.data, slug)
    errors.push(...validation.errors)
    warnings.push(...validation.warnings)

    const duplicateCheck = await checkZukanImportDuplicates(parsed.data)
    warnings.push(...duplicateCheck.warnings)

    return {
      slug,
      fileName,
      code: toStringOrNull(parsed.data.pack?.code),
      name: toStringOrNull(parsed.data.pack?.name),
      cardCount: toNumberOrNull(parsed.data.pack?.card_count),
      cardsLength: Array.isArray(parsed.data.cards) ? parsed.data.cards.length : null,
      isValid: errors.length === 0,
      isDuplicateCheckDone: duplicateCheck.checked,
      isRegistered: duplicateCheck.existingPackSlugs.length > 0 || duplicateCheck.existingCardSlugs.length > 0,
      errors: [...errors, ...duplicateCheck.errors],
      warnings,
    }
  }))

  return options
}
