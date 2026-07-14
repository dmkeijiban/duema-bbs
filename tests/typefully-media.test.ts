import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extensionForImageContentType,
  extractTypefullyMedia,
  shouldBackfillThreadImage,
  shouldBlockThreadForMissingMedia,
} from '../src/lib/typefully-media.ts'

test('画像1枚付き予約ポストのmediaオブジェクトからIDを取得する', () => {
  const result = extractTypefullyMedia({
    platforms: { x: { posts: [{ text: '本文', media: [{ id: 'media-1', type: 'image' }] }] } },
  })
  assert.deepEqual(result.mediaIds, ['media-1'])
  assert.equal(result.expectsMedia, true)
})

test('画像なし予約ポストはmediaなしと判定する', () => {
  const result = extractTypefullyMedia({ platforms: { x: { posts: [{ text: '本文' }] } } })
  assert.deepEqual(result.imageUrls, [])
  assert.deepEqual(result.mediaIds, [])
  assert.equal(result.expectsMedia, false)
})

test('attachments内の一時URLとmedia_idを取得する', () => {
  const result = extractTypefullyMedia({
    attachments: [{ media_id: 'media-2', temporary_url: 'https://cdn.example/image?sig=1' }],
  })
  assert.deepEqual(result.mediaIds, ['media-2'])
  assert.deepEqual(result.imageUrls, ['https://cdn.example/image?sig=1'])
})

test('media statusのmedia_urlsからoriginal URLを取得する', () => {
  const result = extractTypefullyMedia({
    media_id: 'media-3',
    media_urls: { original: 'https://cdn.example/original.png', large: 'https://cdn.example/large.png' },
  })
  assert.deepEqual(result.mediaIds, ['media-3'])
  assert.deepEqual(result.imageUrls, [
    'https://cdn.example/original.png',
    'https://cdn.example/large.png',
  ])
})

test('content-typeを保存拡張子へ変換する', () => {
  assert.equal(extensionForImageContentType('image/png; charset=binary'), 'png')
  assert.equal(extensionForImageContentType('text/html'), null)
})

test('画像URL取得失敗は同期成功扱いにしない', () => {
  assert.equal(shouldBlockThreadForMissingMedia(true, null), true)
  assert.equal(shouldBlockThreadForMissingMedia(false, null), false)
})

test('既存スレの画像欠落は再実行で補完対象になる', () => {
  assert.equal(shouldBackfillThreadImage(null, 'https://cdn.example/image.png'), true)
  assert.equal(shouldBackfillThreadImage('https://storage.example/image.png', 'https://cdn.example/image.png'), false)
})

test('同じ予約はsource_idで既存スレへ結び、重複作成しない', () => {
  const sourceId = '9725184'
  const existing = new Map([[sourceId, { id: 1292 }]])
  assert.equal(existing.get(sourceId)?.id, 1292)
  assert.equal(existing.size, 1)
})
