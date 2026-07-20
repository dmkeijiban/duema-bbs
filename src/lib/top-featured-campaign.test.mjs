import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TOP_FEATURED_CAMPAIGN,
  isSafeTopFeaturedLink,
  parseTopFeaturedCampaignSettings,
  resolveTopFeaturedCampaign,
} from './top-featured-campaign.ts'

const settings = (overrides = {}) => ({
  ...DEFAULT_TOP_FEATURED_CAMPAIGN,
  enabled: true,
  projectSlug: 'my-duema-9',
  title: 'あなたを象徴するデュエマカード9選',
  mainButtonLabel: '9選を作る',
  mainButtonLink: '/makers/my-duema-9',
  subButtonLabel: 'みんなの9選を見る',
  subButtonLink: '/makers/my-duema-9/submissions',
  ...overrides,
})

const project = (overrides = {}) => ({
  slug: 'my-duema-9',
  title: 'あなたを象徴するデュエマカード9選',
  description: '企画説明',
  thumbnailUrl: '',
  visible: true,
  ...overrides,
})

test('表示ONかつ対象企画が公開中なら解決される', () => {
  const resolved = resolveTopFeaturedCampaign(settings(), project())
  assert.equal(resolved.title, 'あなたを象徴するデュエマカード9選')
  assert.equal(resolved.mainHref, '/makers/my-duema-9')
  assert.equal(resolved.subHref, '/makers/my-duema-9/submissions')
})

test('表示OFFならnull', () => {
  assert.equal(resolveTopFeaturedCampaign(settings({ enabled: false }), project()), null)
})

test('対象企画が非公開ならPOP全体を自動非表示', () => {
  assert.equal(resolveTopFeaturedCampaign(settings(), project({ visible: false })), null)
})

test('対象企画が見つからない場合も非表示', () => {
  assert.equal(resolveTopFeaturedCampaign(settings(), null), null)
})

test('サブボタン名またはリンクが空ならサブボタンを表示しない', () => {
  const resolved = resolveTopFeaturedCampaign(settings({ subButtonLabel: '' }), project())
  assert.equal(resolved.subHref, null)
  assert.equal(resolved.subLabel, null)
})

test('不正なメインリンクはPOPごと非表示にする（リンク切れ防止）', () => {
  assert.equal(resolveTopFeaturedCampaign(settings({ mainButtonLink: 'javascript:alert(1)' }), project()), null)
})

test('画像未設定時は企画のサムネイル→既定画像の順でフォールバックする', () => {
  const withThumbnail = resolveTopFeaturedCampaign(settings(), project({ thumbnailUrl: '/images/makers/thumb.webp' }))
  assert.equal(withThumbnail.imageUrl, '/images/makers/thumb.webp')

  const withoutThumbnail = resolveTopFeaturedCampaign(settings(), project({ thumbnailUrl: '' }))
  assert.equal(withoutThumbnail.imageUrl, '/default-thumbnail.jpg')
})

test('isSafeTopFeaturedLink は内部パスとhttp(s)のみ許可する', () => {
  assert.equal(isSafeTopFeaturedLink('/makers/my-duema-9'), true)
  assert.equal(isSafeTopFeaturedLink('https://example.com/a'), true)
  assert.equal(isSafeTopFeaturedLink('javascript:alert(1)'), false)
  assert.equal(isSafeTopFeaturedLink(''), false)
})

test('JSON壊れ・未設定時はデフォルト（非表示）を返す', () => {
  assert.deepEqual(parseTopFeaturedCampaignSettings(null), DEFAULT_TOP_FEATURED_CAMPAIGN)
  assert.deepEqual(parseTopFeaturedCampaignSettings('not json'), DEFAULT_TOP_FEATURED_CAMPAIGN)
})
