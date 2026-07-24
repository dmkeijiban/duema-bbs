import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAutoZone, isSpecialSlotCard, sameCardLimit, DECK_ZONE_LIMITS, entryZone, zoneDeckSize, type DeckEntry } from './deck-maker'

test('resolveAutoZone: outside advance format everything collapses to main', () => {
  assert.equal(resolveAutoZone('gr', 'original'), 'main')
  assert.equal(resolveAutoZone('hyperspatial', 'original'), 'main')
  assert.equal(resolveAutoZone('special', 'original'), 'main')
  assert.equal(resolveAutoZone('normal', 'original'), 'main')
})

test('resolveAutoZone: advance format routes GR/hyperspatial by deck_zone_class, never by any tab selection', () => {
  assert.equal(resolveAutoZone('gr', 'advance'), 'gr')
  assert.equal(resolveAutoZone('hyperspatial', 'advance'), 'hyperspatial')
  assert.equal(resolveAutoZone('normal', 'advance'), 'main')
  assert.equal(resolveAutoZone(null, 'advance'), 'main')
  assert.equal(resolveAutoZone(undefined, 'advance'), 'main')
})

test("resolveAutoZone: 'special' is never a cards-array zone, even in advance format", () => {
  // A card classified 'special' (最終禁断フィールド / 零龍クリーチャー) added through
  // normal search+add always lands in main, exactly like any other non-GR/
  // non-hyperspatial card. The special slot is a separate deck-level pick (see
  // isSpecialSlotCard) with its own UI, never a zone in the cards array —
  // confirmed by the research doc: searching for and adding 零龍 lands it in the
  // main deck, a completely different action from picking it as the special slot.
  assert.equal(resolveAutoZone('special', 'advance'), 'main')
})

test('isSpecialSlotCard: only cards classified special are eligible for the single special-slot pick', () => {
  assert.equal(isSpecialSlotCard('special'), true)
  assert.equal(isSpecialSlotCard('gr'), false)
  assert.equal(isSpecialSlotCard('hyperspatial'), false)
  assert.equal(isSpecialSlotCard('normal'), false)
  assert.equal(isSpecialSlotCard(null), false)
  assert.equal(isSpecialSlotCard(undefined), false)
})

test('sameCardLimit: GR is a hard 2-of-a-kind zone, every other zone keeps 4', () => {
  assert.equal(sameCardLimit('gr'), 2)
  assert.equal(sameCardLimit('main'), 4)
  assert.equal(sameCardLimit('hyperspatial'), 4)
  assert.equal(sameCardLimit('special'), 1)
})

test('DECK_ZONE_LIMITS: matches the advance-format zone caps from the research doc', () => {
  assert.deepEqual(DECK_ZONE_LIMITS, { main: 40, gr: 12, hyperspatial: 8, special: 1 })
})

test('zoneDeckSize: sums only the requested zone, defaulting missing zone to main', () => {
  const entries: DeckEntry[] = [
    { id: 'a', name: 'A', nameKana: null, imageUrl: null, officialPageUrl: null, sourceKey: null, count: 4, zone: 'main' },
    { id: 'b', name: 'B', nameKana: null, imageUrl: null, officialPageUrl: null, sourceKey: null, count: 2, zone: 'gr' },
    { id: 'c', name: 'C', nameKana: null, imageUrl: null, officialPageUrl: null, sourceKey: null, count: 1 }, // no zone -> main
  ]
  assert.equal(zoneDeckSize(entries, 'main'), 5)
  assert.equal(zoneDeckSize(entries, 'gr'), 2)
  assert.equal(zoneDeckSize(entries, 'hyperspatial'), 0)
  assert.equal(entryZone(entries[2]), 'main')
})
