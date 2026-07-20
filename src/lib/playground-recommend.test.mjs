import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS,
  parsePlaygroundRecommendSettings,
  resolvePlaygroundRecommendedSlug,
} from './playground-recommend.ts'

test('連動ONならTOP注目企画のslugを返す', () => {
  const slug = resolvePlaygroundRecommendedSlug({ useTopFeatured: true, projectSlug: 'other' }, 'my-duema-9')
  assert.equal(slug, 'my-duema-9')
})

test('連動OFFなら個別設定のslugを返す', () => {
  const slug = resolvePlaygroundRecommendedSlug({ useTopFeatured: false, projectSlug: 'other' }, 'my-duema-9')
  assert.equal(slug, 'other')
})

test('未設定時はデフォルト（連動OFF・未指定）', () => {
  assert.deepEqual(parsePlaygroundRecommendSettings(null), DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS)
})
