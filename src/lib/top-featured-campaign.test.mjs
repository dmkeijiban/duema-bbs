import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampFeaturedCampaignNumber,
  computeFeaturedCampaignImageStyle,
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

test('既存設定に位置情報がなくても初期値（50/50/1）で解決される', () => {
  const resolved = resolveTopFeaturedCampaign(settings(), project())
  assert.equal(resolved.imagePositionX, 50)
  assert.equal(resolved.imagePositionY, 50)
  assert.equal(resolved.imageScale, 1)
})

test('位置・拡大率はJSONの値がそのまま解決結果に反映される', () => {
  const resolved = resolveTopFeaturedCampaign(settings({ imagePositionX: 20, imagePositionY: 80, imageScale: 1.5 }), project())
  assert.equal(resolved.imagePositionX, 20)
  assert.equal(resolved.imagePositionY, 80)
  assert.equal(resolved.imageScale, 1.5)
})

test('clampFeaturedCampaignNumber は範囲外をmin/maxへ、NaN/不正文字列をfallbackへ丸める', () => {
  assert.equal(clampFeaturedCampaignNumber(150, 0, 100, 50), 100)
  assert.equal(clampFeaturedCampaignNumber(-10, 0, 100, 50), 0)
  assert.equal(clampFeaturedCampaignNumber(30, 0, 100, 50), 30)
  assert.equal(clampFeaturedCampaignNumber('abc', 0, 100, 50), 50)
  assert.equal(clampFeaturedCampaignNumber(undefined, 0, 100, 50), 50)
  assert.equal(clampFeaturedCampaignNumber(NaN, 0, 100, 50), 50)
  assert.equal(clampFeaturedCampaignNumber('75', 0, 100, 50), 75)
})

test('parseTopFeaturedCampaignSettings は位置・拡大率が不正でも初期値へフォールバックする', () => {
  const raw = JSON.stringify({
    enabled: true,
    projectSlug: 'my-duema-9',
    imagePositionX: 999,
    imagePositionY: 'not-a-number',
    imageScale: 5,
  })
  const parsed = parseTopFeaturedCampaignSettings(raw)
  assert.equal(parsed.imagePositionX, 100)
  assert.equal(parsed.imagePositionY, 50)
  assert.equal(parsed.imageScale, 2)
})

test('resolveTopFeaturedCampaign も不正な位置・拡大率をクランプする（サーバー側の二重防御）', () => {
  const resolved = resolveTopFeaturedCampaign(settings({ imagePositionX: -20, imagePositionY: 500, imageScale: 0.1 }), project())
  assert.equal(resolved.imagePositionX, 0)
  assert.equal(resolved.imagePositionY, 100)
  assert.equal(resolved.imageScale, 1)
})

test('computeFeaturedCampaignImageStyle はobjectPosition/transformを生成しクランプする', () => {
  assert.deepEqual(computeFeaturedCampaignImageStyle(20, 80, 1.5), {
    objectPosition: '20% 80%',
    transform: 'scale(1.5)',
    transformOrigin: 'center',
  })
  assert.deepEqual(computeFeaturedCampaignImageStyle(-10, 200, 9), {
    objectPosition: '0% 100%',
    transform: 'scale(2)',
    transformOrigin: 'center',
  })
})

test('デフォルト設定はcardImages 3枠を空で持つ', () => {
  assert.equal(DEFAULT_TOP_FEATURED_CAMPAIGN.cardImages.length, 3)
  for (const card of DEFAULT_TOP_FEATURED_CAMPAIGN.cardImages) {
    assert.deepEqual(card, { imageUrl: '', positionX: 50, positionY: 50, scale: 1 })
  }
})

const cardImage = (overrides = {}) => ({ imageUrl: '/images/card.webp', positionX: 50, positionY: 50, scale: 1, ...overrides })

test('カード画像が3枚とも有効ならimageMode=cardsで3枚とも返す', () => {
  const resolved = resolveTopFeaturedCampaign(
    settings({ cardImages: [cardImage({ imageUrl: '/c1.webp' }), cardImage({ imageUrl: '/c2.webp' }), cardImage({ imageUrl: '/c3.webp' })] }),
    project()
  )
  assert.equal(resolved.imageMode, 'cards')
  assert.deepEqual(resolved.cardImages.map(c => c.imageUrl), ['/c1.webp', '/c2.webp', '/c3.webp'])
})

test('カード画像が1〜2枚だけでも、その枚数だけ均等表示される', () => {
  const oneCard = resolveTopFeaturedCampaign(
    settings({ cardImages: [cardImage({ imageUrl: '/c1.webp' }), cardImage({ imageUrl: '' }), cardImage({ imageUrl: '' })] }),
    project()
  )
  assert.equal(oneCard.imageMode, 'cards')
  assert.equal(oneCard.cardImages.length, 1)

  const twoCards = resolveTopFeaturedCampaign(
    settings({ cardImages: [cardImage({ imageUrl: '' }), cardImage({ imageUrl: '/c2.webp' }), cardImage({ imageUrl: '/c3.webp' })] }),
    project()
  )
  assert.equal(twoCards.imageMode, 'cards')
  assert.deepEqual(twoCards.cardImages.map(c => c.imageUrl), ['/c2.webp', '/c3.webp'])
})

test('カード画像が3枚とも未設定なら旧1枚画像設定へフォールバックする（imageMode=single）', () => {
  const resolved = resolveTopFeaturedCampaign(settings({ imageUrl: '/single.webp' }), project())
  assert.equal(resolved.imageMode, 'single')
  assert.equal(resolved.imageUrl, '/single.webp')
  assert.equal(resolved.cardImages.length, 0)
})

test('不正なカード画像URL（javascript:など）は無効枠として除外される', () => {
  const resolved = resolveTopFeaturedCampaign(
    settings({ cardImages: [cardImage({ imageUrl: 'javascript:alert(1)' }), cardImage({ imageUrl: '' }), cardImage({ imageUrl: '' })] }),
    project()
  )
  assert.equal(resolved.imageMode, 'single')
  assert.equal(resolved.cardImages.length, 0)
})

test('各カード画像のposition/scaleは個別にクランプされる', () => {
  const resolved = resolveTopFeaturedCampaign(
    settings({ cardImages: [cardImage({ imageUrl: '/c1.webp', positionX: 999, positionY: -50, scale: 10 })] }),
    project()
  )
  assert.deepEqual(resolved.cardImages[0], { imageUrl: '/c1.webp', positionX: 100, positionY: 0, scale: 2 })
})

test('parseTopFeaturedCampaignSettings はcardImagesを常に3枠へ正規化しクランプする', () => {
  const raw = JSON.stringify({
    enabled: true,
    projectSlug: 'my-duema-9',
    cardImages: [
      { imageUrl: '/c1.webp', positionX: 200, positionY: -10, scale: 0.1 },
      { imageUrl: '/c2.webp' },
    ],
  })
  const parsed = parseTopFeaturedCampaignSettings(raw)
  assert.equal(parsed.cardImages.length, 3)
  assert.deepEqual(parsed.cardImages[0], { imageUrl: '/c1.webp', positionX: 100, positionY: 0, scale: 1 })
  assert.deepEqual(parsed.cardImages[1], { imageUrl: '/c2.webp', positionX: 50, positionY: 50, scale: 1 })
  assert.deepEqual(parsed.cardImages[2], { imageUrl: '', positionX: 50, positionY: 50, scale: 1 })
})

test('cardImagesが配列でない・欠損している場合も3枠の空配列へフォールバックする', () => {
  assert.deepEqual(parseTopFeaturedCampaignSettings(JSON.stringify({ enabled: true })).cardImages, DEFAULT_TOP_FEATURED_CAMPAIGN.cardImages)
})
