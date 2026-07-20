import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TOP_GREEN_BANNER_BUTTONS,
  parseTopGreenBannerButtons,
  resolveVisibleTopGreenBannerButtons,
} from './top-green-banner.ts'

test('デフォルト3ボタンが順番通りに表示される', () => {
  const visible = resolveVisibleTopGreenBannerButtons(DEFAULT_TOP_GREEN_BANNER_BUTTONS)
  assert.deepEqual(visible.map(b => b.label), ['アカウント作成', 'デュエマあそびば', '新しいお知らせ'])
})

test('非表示・ラベルまたはリンクが空のボタンは除外される', () => {
  const buttons = [
    { enabled: false, label: 'A', href: '/a', icon: '', openInNewTab: false, emphasis: false, order: 0 },
    { enabled: true, label: '', href: '/b', icon: '', openInNewTab: false, emphasis: false, order: 1 },
    { enabled: true, label: 'C', href: '', icon: '', openInNewTab: false, emphasis: false, order: 2 },
  ]
  assert.deepEqual(resolveVisibleTopGreenBannerButtons(buttons), [])
})

test('0件でも配列として返る（空領域を残さない判定に使える）', () => {
  assert.deepEqual(resolveVisibleTopGreenBannerButtons([]), [])
})

test('並び順(order)でソートされる', () => {
  const buttons = [
    { enabled: true, label: 'B', href: '/b', icon: '', openInNewTab: false, emphasis: false, order: 2 },
    { enabled: true, label: 'A', href: '/a', icon: '', openInNewTab: false, emphasis: false, order: 1 },
  ]
  assert.deepEqual(resolveVisibleTopGreenBannerButtons(buttons).map(b => b.label), ['A', 'B'])
})

test('JSON不正・未設定時はデフォルト3ボタンにフォールバック', () => {
  assert.deepEqual(parseTopGreenBannerButtons(null), DEFAULT_TOP_GREEN_BANNER_BUTTONS)
  assert.deepEqual(parseTopGreenBannerButtons('not json'), DEFAULT_TOP_GREEN_BANNER_BUTTONS)
})
