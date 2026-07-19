import assert from 'node:assert/strict'
import test from 'node:test'
import { compareCardPrintingsOfficial, type CardPrintingOrder } from './card-printing-order'

const printing = (values: Partial<CardPrintingOrder> & Pick<CardPrintingOrder, 'id' | 'source_key'>): CardPrintingOrder => ({
  release_date: null,
  official_sort_position: null,
  card_number: null,
  ...values,
})

test('公式表示位置が先行32件と全件で同じ順を作る', () => {
  const rows = [
    printing({ id: '3', source_key: 'dm26ex2-PR001CHO', official_sort_position: 3 }),
    printing({ id: '1', source_key: 'dm26ex2-MC001', official_sort_position: 1 }),
    printing({ id: '2', source_key: 'dm26ex2-PR001', official_sort_position: 2 }),
  ].sort(compareCardPrintingsOfficial)
  assert.deepEqual(rows.map((row) => row.source_key), ['dm26ex2-MC001', 'dm26ex2-PR001', 'dm26ex2-PR001CHO'])
  assert.deepEqual(rows.slice(0, 2), [...rows].sort(compareCardPrintingsOfficial).slice(0, 2))
})

test('未採番では発売日降順、同日内はカード番号順、末尾はUUIDで安定する', () => {
  const rows = [
    printing({ id: 'b', source_key: 'set-002', release_date: '2026-01-01', card_number: '2' }),
    printing({ id: 'c', source_key: 'set-001b', release_date: '2026-01-01', card_number: '1' }),
    printing({ id: 'a', source_key: 'set-001a', release_date: '2026-01-01', card_number: '1' }),
    printing({ id: 'd', source_key: 'old-001', release_date: '2025-12-31', card_number: '1' }),
  ].sort(compareCardPrintingsOfficial)
  assert.deepEqual(rows.map((row) => row.id), ['a', 'c', 'b', 'd'])
})

test('null発売日は末尾、ページ境界を連結しても重複・欠落しない', () => {
  const rows = Array.from({ length: 97 }, (_, index) => printing({
    id: String(index).padStart(3, '0'),
    source_key: `set-${index + 1}`,
    release_date: index === 96 ? null : '2026-01-01',
    official_sort_position: index + 1,
  })).sort(compareCardPrintingsOfficial)
  const paged = [rows.slice(0, 48), rows.slice(48, 96), rows.slice(96)].flat()
  assert.equal(new Set(paged.map((row) => row.id)).size, 97)
  assert.deepEqual(paged, rows)
})
