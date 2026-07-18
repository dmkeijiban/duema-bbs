import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isMakerProjectArchived,
  isMakerProjectPageAccessible,
  isMakerProjectVisible,
  parseMakerCatalogConfig,
} from './maker-catalog.ts'

const project = (overrides = {}) => ({
  slug: 'sample',
  type: 'select',
  status: 'published',
  is_public: true,
  config: { catalog: { showInCatalog: true, category: 'play', sortOrder: 10 } },
  ...overrides,
})

test('新旧typeを共通カテゴリへ分類する', () => {
  assert.equal(parseMakerCatalogConfig(project({ type: 'tier', config: { catalog: { category: 'vote' } } })).category, 'create')
  assert.equal(parseMakerCatalogConfig(project({ type: 'prediction', config: { catalog: { category: 'vote' } } })).category, 'event')
  assert.equal(parseMakerCatalogConfig(project({ type: 'qa', config: null })).category, 'play')
})

test('公開・一覧・期間をすべて満たした企画だけ一覧表示する', () => {
  const now = new Date('2026-07-18T12:00:00Z')
  assert.equal(isMakerProjectVisible(project(), now), true)
  assert.equal(isMakerProjectVisible(project({ status: 'scheduled' }), now), false)
  assert.equal(isMakerProjectVisible(project({ status: 'scheduled', config: { catalog: { startsAt: '2026-07-18T11:00:00Z' } } }), now), true)
  assert.equal(isMakerProjectVisible(project({ config: { catalog: { showInCatalog: false } } }), now), false)
  assert.equal(isMakerProjectVisible(project({ config: { catalog: { startsAt: '2026-07-19T00:00:00Z' } } }), now), false)
})

test('終了後アーカイブONはアーカイブへ移動し詳細を閲覧できる', () => {
  const now = new Date('2026-07-18T12:00:00Z')
  const ended = project({ status: 'ended', config: { catalog: { showInCatalog: true, showInArchive: true } } })
  assert.equal(isMakerProjectArchived(ended, now), true)
  assert.equal(isMakerProjectVisible(ended, now), true)
  assert.equal(isMakerProjectPageAccessible(ended, now), true)
})
