import assert from 'node:assert/strict'
import test from 'node:test'
import { getSpecialSlotOptions, isAllowedSpecialCardId, isAllowedSpecialCardIdWithGrandfather } from './special-slot-options'

type RepRow = { key: string; card_id: string }
type CardRow = { id: string; image_url: string | null; is_active: boolean; deck_zone_class: string | null }

// Minimal stand-in for the Supabase query builder used by getSpecialSlotOptions:
// .from('special_slot_representatives').select() and .from('cards').select().in()
// must both chain and be awaitable, resolving to { data, error }.
function makeAdminStub(reps: RepRow[], cards: CardRow[]) {
  return {
    from: (table: string) => {
      if (table === 'special_slot_representatives') {
        return { select: () => ({ then: (resolve: (v: { data: RepRow[]; error: null }) => void) => resolve({ data: reps, error: null }) }) }
      }
      if (table === 'cards') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => ({
              then: (resolve: (v: { data: CardRow[]; error: null }) => void) =>
                resolve({ data: cards.filter(c => ids.includes(c.id)), error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as Parameters<typeof getSpecialSlotOptions>[0]
}

const baseReps: RepRow[] = [
  { key: 'dormageddon', card_id: 'a-dolmageddon' },
  { key: 'zeroryu', card_id: 'c-zeron' },
]
const baseCards: CardRow[] = [
  { id: 'a-dolmageddon', image_url: 'https://example.test/dolma.jpg', is_active: true, deck_zone_class: 'special' },
  { id: 'c-zeron', image_url: 'https://example.test/zeron.jpg', is_active: true, deck_zone_class: 'special' },
]

test('getSpecialSlotOptions: returns the fixed dormageddon/zeroryu keys with stable cardIds', async () => {
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, baseCards))
  assert.equal(options.length, 2)
  assert.deepEqual(options.map(o => o.key).sort(), ['dormageddon', 'zeroryu'])
  assert.deepEqual(options.map(o => o.cardId).sort(), ['a-dolmageddon', 'c-zeron'])
})

test('getSpecialSlotOptions: representative unaffected by mapping-row / card-row ordering', async () => {
  // Same data, rows returned in reverse order — simulates a DB that doesn't
  // guarantee row order without an explicit ORDER BY. The representative
  // cardId for each key must not depend on this.
  const reversedReps = [...baseReps].reverse()
  const reversedCards = [...baseCards].reverse()
  const options = await getSpecialSlotOptions(makeAdminStub(reversedReps, reversedCards))
  const byKey = Object.fromEntries(options.map(o => [o.key, o.cardId]))
  assert.equal(byKey.dormageddon, 'a-dolmageddon')
  assert.equal(byKey.zeroryu, 'c-zeron')
})

test('getSpecialSlotOptions: unaffected by another card of the same cardType being added', async () => {
  // A newly added 最終禁断フィールド/零龍クリーチャー card with a smaller UUID must not
  // steal the representative slot — only the explicit mapping table decides.
  const extraCards: CardRow[] = [
    ...baseCards,
    { id: '0000-new-smaller-uuid', image_url: null, is_active: true, deck_zone_class: 'special' },
  ]
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, extraCards))
  const byKey = Object.fromEntries(options.map(o => [o.key, o.cardId]))
  assert.equal(byKey.dormageddon, 'a-dolmageddon')
  assert.equal(byKey.zeroryu, 'c-zeron')
  assert.equal(options.length, 2)
})

test('getSpecialSlotOptions: candidate count stays at 2 even as printings/image variants increase', async () => {
  // Simulates the represented cards each having multiple printings/images —
  // getSpecialSlotOptions only ever looks at the logical cards.id from the
  // mapping table, so printing-level duplication can't inflate the count.
  const manyCards: CardRow[] = [
    ...baseCards,
    { id: 'a-dolmageddon-printing-2', image_url: 'https://example.test/dolma-v2.jpg', is_active: true, deck_zone_class: 'special' },
    { id: 'c-zeron-printing-2', image_url: 'https://example.test/zeron-v2.jpg', is_active: true, deck_zone_class: 'special' },
  ]
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, manyCards))
  assert.equal(options.length, 2)
})

test('getSpecialSlotOptions: detects a missing candidate instead of silently returning 1', async () => {
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => { errors.push(args) }
  try {
    const repsMissingZeron = [baseReps[0]]
    const options = await getSpecialSlotOptions(makeAdminStub(repsMissingZeron, baseCards))
    assert.equal(options.length, 1)
    assert.equal(options[0].key, 'dormageddon')
    assert.ok(errors.some(args => String(args[0]).includes('zeroryu')), 'expected a console.error mentioning the missing key')
  } finally {
    console.error = originalError
  }
})

test('getSpecialSlotOptions: empty mapping table yields empty options with logged errors, not a throw', async () => {
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => { errors.push(args) }
  try {
    const options = await getSpecialSlotOptions(makeAdminStub([], []))
    assert.deepEqual(options, [])
    assert.equal(errors.length, 2)
  } finally {
    console.error = originalError
  }
})

test('isAllowedSpecialCardId: null ("なし") is always allowed', () => {
  assert.equal(isAllowedSpecialCardId([], null), true)
})

test('isAllowedSpecialCardId: accepts the current representative cardIds, rejects anything else', async () => {
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, baseCards))
  assert.equal(isAllowedSpecialCardId(options, 'a-dolmageddon'), true)
  assert.equal(isAllowedSpecialCardId(options, 'c-zeron'), true)
  // An arbitrary ordinary card, or a different special-classified card that
  // isn't the designated representative, must be rejected.
  assert.equal(isAllowedSpecialCardId(options, 'some-ordinary-creature-id'), false)
  assert.equal(isAllowedSpecialCardId(options, '0000-new-smaller-uuid'), false)
})

test('isAllowedSpecialCardIdWithGrandfather: an existing legitimate specialCardId is accepted at save time even if the mapping later moved on', async () => {
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, baseCards))
  // Deck already has 'a-dolmageddon' saved; re-saving the same unchanged value must
  // succeed even in a hypothetical future where the mapping no longer lists it.
  assert.equal(isAllowedSpecialCardIdWithGrandfather(options, 'a-dolmageddon', 'a-dolmageddon'), true)
  const staleRepresentativeOptions: typeof options = []
  assert.equal(isAllowedSpecialCardIdWithGrandfather(staleRepresentativeOptions, 'a-dolmageddon', 'a-dolmageddon'), true)
})

test('isAllowedSpecialCardIdWithGrandfather: a different special-classified card id is still rejected', async () => {
  const options = await getSpecialSlotOptions(makeAdminStub(baseReps, baseCards))
  // Deck currently has 'a-dolmageddon' saved, but the request tries to switch to
  // an id that is neither the current representative nor the deck's existing value.
  assert.equal(isAllowedSpecialCardIdWithGrandfather(options, '0000-new-smaller-uuid', 'a-dolmageddon'), false)
})
