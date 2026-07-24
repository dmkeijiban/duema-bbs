import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { SPECIAL_SLOT_REPRESENTATIVE_RULES, resolveRepresentative, type RepresentativeCandidateRow } from './special-slot-representative-rules'

const migrationPath = resolve(import.meta.dirname, '../../supabase/migrations/20260724190000_special_slot_representatives.sql')

test('resolveRepresentative: dormageddon resolves to the single 最終禁断フィールド logical card', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'forbidden-star-id', card_type: '最終禁断フィールド', deck_zone_class: 'special', is_active: true, source_key: 'dmbd21-001' },
    { id: 'unrelated-gr-id', card_type: 'GRクリーチャー', deck_zone_class: 'gr', is_active: true, source_key: 'other' },
  ]
  const result = resolveRepresentative(rows, 'dormageddon')
  assert.deepEqual(result, { ok: true, cardId: 'forbidden-star-id' })
})

test('resolveRepresentative: zeroryu resolves to the dmbd22-001 ritual twinpact, not the other four equally-valid 零龍 backs', () => {
  // Production data (verified read-only via /api/cards/search on 2026-07-24) has 5
  // distinct "○○の儀" ritual twinpacts, all with a "零龍" back face but each with a
  // different front cards.card_type/card_id — none of them is literally
  // card_type='零龍クリーチャー' at the cards level. dmbd22-001 was confirmed by the
  // maintainer as the representative; the other four must NOT match.
  const rows: RepresentativeCandidateRow[] = [
    { id: 'd0dab9d1-8c2a-49e0-8837-33d33953e973', card_type: '零龍の儀', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-001' },
    { id: '5a4c65ab-7617-41ef-8f24-2d9c2235318c', card_type: '零龍星雲', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-002' },
    { id: '6392b520-56a8-44af-b08c-df6a3c615b4d', card_type: '零龍星雲', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-003' },
    { id: '308fb9af-1450-43eb-bcf7-dd8a5d696e6b', card_type: '零龍星雲', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-004' },
    { id: '473504a7-b6dd-475d-b681-ffebe57f6f71', card_type: '零龍星雲', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-005' },
  ]
  const result = resolveRepresentative(rows, 'zeroryu')
  assert.deepEqual(result, { ok: true, cardId: 'd0dab9d1-8c2a-49e0-8837-33d33953e973' })
})

test('resolveRepresentative: a naive card_type-only match for zeroryu (no such standalone card exists) is not_found', () => {
  // Regression guard for the original (wrong) assumption that
  // cards.card_type = '零龍クリーチャー' matches a standalone catalog entry —
  // production has no such row, only card_faces back faces carry that type.
  const rows: RepresentativeCandidateRow[] = [
    { id: 'some-card', card_type: '零龍クリーチャー', deck_zone_class: 'special', is_active: true, source_key: 'irrelevant' },
  ]
  const result = resolveRepresentative(rows, 'zeroryu')
  assert.deepEqual(result, { ok: false, reason: 'not_found', count: 0 })
})

test('resolveRepresentative: zero matching candidates is reported as not_found, never silently empty', () => {
  const result = resolveRepresentative([], 'dormageddon')
  assert.deepEqual(result, { ok: false, reason: 'not_found', count: 0 })
})

test('resolveRepresentative: multiple matching candidates (e.g. a duplicated source_key) is reported as multiple_matches, never silently picks the first', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'zeroryu-a', card_type: '零龍の儀', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-001' },
    { id: 'zeroryu-b', card_type: '零龍の儀', deck_zone_class: 'special', is_active: true, source_key: 'dmbd22-001' },
  ]
  const result = resolveRepresentative(rows, 'zeroryu')
  assert.deepEqual(result, { ok: false, reason: 'multiple_matches', count: 2 })
})

test('resolveRepresentative: inactive or non-special-classified rows never count as candidates', () => {
  const rows: RepresentativeCandidateRow[] = [
    { id: 'inactive-forbidden-star', card_type: '最終禁断フィールド', deck_zone_class: 'special', is_active: false, source_key: 'dmbd21-001' },
    { id: 'reclassified-forbidden-star', card_type: '最終禁断フィールド', deck_zone_class: 'normal', is_active: true, source_key: 'dmbd21-001' },
  ]
  const result = resolveRepresentative(rows, 'dormageddon')
  assert.deepEqual(result, { ok: false, reason: 'not_found', count: 0 })
})

test('migration SQL uses the exact same card_type/source_key literals as SPECIAL_SLOT_REPRESENTATIVE_RULES', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.ok(sql.includes(`card_type = '${SPECIAL_SLOT_REPRESENTATIVE_RULES.dormageddon.cardType}'`), 'migration must match dormageddon by the same card_type as the shared rules constant')
  assert.ok(sql.includes(`card_type = '${SPECIAL_SLOT_REPRESENTATIVE_RULES.zeroryu.cardType}'`), 'migration must match zeroryu by the same card_type as the shared rules constant')
  assert.ok(sql.includes(`source_key = '${SPECIAL_SLOT_REPRESENTATIVE_RULES.zeroryu.sourceKey}'`), 'migration must pin zeroryu to the same source_key as the shared rules constant')
})

test('migration SQL fails loudly (no silent single-candidate fallback) on 0 or 2+ matches', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.ok(/select\s+.*into\s+strict/i.test(sql), 'migration must use SELECT INTO STRICT so 0/2+ rows raise automatically')
  assert.ok(/when\s+no_data_found\s+then/i.test(sql), 'migration must explicitly handle the 0-match case')
  assert.ok(/when\s+too_many_rows\s+then/i.test(sql), 'migration must explicitly handle the 2+-match case')
  assert.ok(/raise\s+exception/i.test(sql), 'migration must abort the transaction on either failure, not just log')
})
