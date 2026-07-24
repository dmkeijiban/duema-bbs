import assert from 'node:assert/strict'
import test from 'node:test'
import { getSpecialSlotOptions, isAllowedSpecialCardId } from './special-slot-options'

type Row = { id: string; name: string; name_kana: string | null; image_url: string | null; card_type: string }

// Minimal stand-in for the Supabase query builder used by getSpecialSlotOptions:
// .from().select().eq().eq().order().order() must all chain and the whole thing
// must be awaitable, resolving to { data, error }. Mirrors the real
// `.order('card_type').order('id')` behavior (getSpecialSlotOptions relies on
// the DB to sort — this stub sorts too, so the test exercises the same
// "first by id within each type" contract instead of insertion order).
function makeAdminStub(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a.card_type.localeCompare(b.card_type) || a.id.localeCompare(b.id))
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (value: { data: Row[]; error: null }) => void) => resolve({ data: sorted, error: null }),
  }
  return { from: () => builder } as unknown as Parameters<typeof getSpecialSlotOptions>[0]
}

test('getSpecialSlotOptions: exactly one representative per special card_type, never more', async () => {
  // Simulates a catalog where each special card_type happens to have more than
  // one logical row (e.g. a data-entry duplicate) — the reduction must still
  // collapse each type down to a single stable representative, so the special
  // slot is always a fixed 2-choice pick (+ "なし"), never a growing list.
  const rows: Row[] = [
    { id: 'b-dolmageddon-dup', name: 'FORBIDDEN STAR duplicate', name_kana: null, image_url: null, card_type: '最終禁断フィールド' },
    { id: 'a-dolmageddon', name: 'ドルマゲドン相当カード', name_kana: null, image_url: 'https://example.test/dolma.jpg', card_type: '最終禁断フィールド' },
    { id: 'c-zeron', name: '零龍相当カード', name_kana: null, image_url: 'https://example.test/zeron.jpg', card_type: '零龍クリーチャー' },
    { id: 'd-zeron-dup', name: '零龍 duplicate', name_kana: null, image_url: null, card_type: '零龍クリーチャー' },
  ]
  const options = await getSpecialSlotOptions(makeAdminStub(rows))
  assert.equal(options.length, 2)
  assert.deepEqual(options.map(o => o.cardType).sort(), ['最終禁断フィールド', '零龍クリーチャー'])
  // Stable pick: first by id within each type (a- sorts before b-, c- before d-).
  assert.deepEqual(options.map(o => o.id).sort(), ['a-dolmageddon', 'c-zeron'])
})

test('getSpecialSlotOptions: empty catalog yields empty options, not an error', async () => {
  const options = await getSpecialSlotOptions(makeAdminStub([]))
  assert.deepEqual(options, [])
})

test('isAllowedSpecialCardId: null ("なし") is always allowed', () => {
  assert.equal(isAllowedSpecialCardId([], null), true)
})

test('isAllowedSpecialCardId: rejects any id not in the reduced candidate list', async () => {
  const rows: Row[] = [
    { id: 'a-dolmageddon', name: 'ドルマゲドン相当カード', name_kana: null, image_url: null, card_type: '最終禁断フィールド' },
    { id: 'c-zeron', name: '零龍相当カード', name_kana: null, image_url: null, card_type: '零龍クリーチャー' },
  ]
  const options = await getSpecialSlotOptions(makeAdminStub(rows))
  assert.equal(isAllowedSpecialCardId(options, 'a-dolmageddon'), true)
  assert.equal(isAllowedSpecialCardId(options, 'c-zeron'), true)
  // Neither an arbitrary ordinary card nor a duplicate-row id that lost the
  // stable-pick tiebreak may be used as specialCardId.
  assert.equal(isAllowedSpecialCardId(options, 'some-ordinary-creature-id'), false)
  assert.equal(isAllowedSpecialCardId(options, 'b-dolmageddon-dup'), false)
})
