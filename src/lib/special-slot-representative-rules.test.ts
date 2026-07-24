import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { SPECIAL_SLOT_REPRESENTATIVE_RULES, resolveRepresentative, type RepresentativeCandidateRow } from './special-slot-representative-rules'

const migrationPath = resolve(import.meta.dirname, '../../supabase/migrations/20260724190000_special_slot_representatives.sql')

test('resolveRepresentative: dormageddon resolves to the single 最終禁断フィールド logical card', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'forbidden-star-id', card_type: '最終禁断フィールド', deck_zone_class: 'special', is_active: true },
    { id: 'unrelated-gr-id', card_type: 'GRクリーチャー', deck_zone_class: 'gr', is_active: true },
  ]
  const result = resolveRepresentative(rows, 'dormageddon')
  assert.deepEqual(result, { ok: true, cardId: 'forbidden-star-id' })
})

test('resolveRepresentative: zeroryu resolves to the single 零龍クリーチャー logical card, ignoring twinpact-ritual back-face duplicates', () => {
  // The "○○の儀" ritual twinpacts (零龍の儀/零龍星雲 front types) each flip to a
  // "零龍" back face, but their own cards.card_type stays the front type — only a
  // standalone 零龍クリーチャー catalog entry should match here.
  const rows: RepresentativeCandidateRow[] = [
    { id: 'zeroryu-standalone-id', card_type: '零龍クリーチャー', deck_zone_class: 'special', is_active: true },
    { id: 'ritual-card-1', card_type: '零龍の儀', deck_zone_class: 'special', is_active: true },
    { id: 'ritual-card-2', card_type: '零龍星雲', deck_zone_class: 'special', is_active: true },
  ]
  const result = resolveRepresentative(rows, 'zeroryu')
  assert.deepEqual(result, { ok: true, cardId: 'zeroryu-standalone-id' })
})

test('resolveRepresentative: zero matching candidates is reported as not_found, never silently empty', () => {
  const result = resolveRepresentative([], 'dormageddon')
  assert.deepEqual(result, { ok: false, reason: 'not_found', count: 0 })
})

test('resolveRepresentative: multiple matching candidates is reported as multiple_matches, never silently picks the first', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'zeroryu-a', card_type: '零龍クリーチャー', deck_zone_class: 'special', is_active: true },
    { id: 'zeroryu-b', card_type: '零龍クリーチャー', deck_zone_class: 'special', is_active: true },
  ]
  const result = resolveRepresentative(rows, 'zeroryu')
  assert.deepEqual(result, { ok: false, reason: 'multiple_matches', count: 2 })
})

test('resolveRepresentative: inactive or non-special-classified rows never count as candidates', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'inactive-forbidden-star', card_type: '最終禁断フィールド', deck_zone_class: 'special', is_active: false },
    { id: 'reclassified-forbidden-star', card_type: '最終禁断フィールド', deck_zone_class: 'normal', is_active: true },
  ]
  const result = resolveRepresentative(rows, 'dormageddon')
  assert.deepEqual(result, { ok: false, reason: 'not_found', count: 0 })
})

test('migration SQL uses the exact same card_type literals as SPECIAL_SLOT_REPRESENTATIVE_RULES', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.ok(sql.includes(`card_type = '${SPECIAL_SLOT_REPRESENTATIVE_RULES.dormageddon.cardType}'`), 'migration must match dormageddon by the same card_type as the shared rules constant')
  assert.ok(sql.includes(`card_type = '${SPECIAL_SLOT_REPRESENTATIVE_RULES.zeroryu.cardType}'`), 'migration must match zeroryu by the same card_type as the shared rules constant')
})

test('migration SQL fails loudly (no silent single-candidate fallback) on 0 or 2+ matches', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.ok(/select\s+id\s+into\s+strict/i.test(sql), 'migration must use SELECT INTO STRICT so 0/2+ rows raise automatically')
  assert.ok(/when\s+no_data_found\s+then/i.test(sql), 'migration must explicitly handle the 0-match case')
  assert.ok(/when\s+too_many_rows\s+then/i.test(sql), 'migration must explicitly handle the 2+-match case')
  assert.ok(/raise\s+exception/i.test(sql), 'migration must abort the transaction on either failure, not just log')
})
