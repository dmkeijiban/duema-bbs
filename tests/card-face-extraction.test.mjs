import test from 'node:test'
import assert from 'node:assert/strict'
import { contentHash, extractOfficialCardFaces, isSuspiciousFaceName, PARSER_VERSION } from '../scripts/cards/card-face-extraction.mjs'

const pageUrl = 'https://dm.takaratomy.co.jp/card/detail/?id=fixture-001'
const detail = ({ name, image, number = '1/1', type = 'クリーチャー', quote = '"' }) => `<div class=${quote}cardDetail${quote}><h3 class=${quote}card-name${quote}>${name}<span class=${quote}packname${quote}>(DMFIX ${number})</span></h3><div class=${quote}card-img${quote}><img src=${quote}${image}${quote}></div><td class=${quote}type${quote}>${type}</td></div>`
const assertFaceBasics = (faces) => {
  assert.deepEqual(faces.map((face) => face.side_index), faces.map((_, index) => index))
  assert.deepEqual(faces.map((face) => face.side_kind), faces.map((_, index) => index === 0 ? 'front' : 'back'))
  assert.equal(faces.every((face) => face.name && face.image_url && face.official_page_url === pageUrl), true)
  assert.equal(new Set(faces.map((face) => face.image_url)).size, faces.length)
}

const html = `
<div class='cardDetail'><h3 class='card-name'>禁断の鼓動<span class='packname'>(DMR19 001/??)</span></h3><div class="card-img"><img src="/wp-content/card/cardimage/dmr19-001.jpg"></div><td class='type'>禁断の鼓動</td></div>
<div class="cardDetail"><h3 class="card-name">伝説の禁断 ドキンダムX<span class="packname">(DMR19 001/??)</span></h3><div class='card-img'><img src='/wp-content/card/cardimage/dmr19-001b.jpg'></div><td class="type">禁断クリーチャー</td></div>
<div class="productCard"></div>`

test('all cardDetail blocks become ordered faces', () => {
  const faces = extractOfficialCardFaces(html, 'https://dm.takaratomy.co.jp/card/detail/?id=dmr19-001')
  assert.equal(faces.length, 2)
  assert.deepEqual(faces.map((face) => face.name), ['禁断の鼓動', '伝説の禁断 ドキンダムX'])
  assert.deepEqual(faces.map((face) => face.side_index), [0, 1])
  assert.equal(faces[1].normalized_name, '伝説の禁断ドキンダムx')
  assert.equal(faces[1].image_url, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr19-001b.jpg')
  assert.equal(faces[0].card_number, '001/??')
  assert.equal(faces[1].side_kind, 'back')
})

test('content hash is stable and content-sensitive', () => {
  assert.equal(contentHash(html), contentHash(html))
  assert.notEqual(contentHash(html), contentHash(`${html} `))
})

test('empty card image detail used by twin-pact metadata is not a separate face', () => {
  const twinPact = `<div class="cardDetail"><h3 class="card-name">表 / 呪文<span class="packname">(DMX 1/2)</span></h3><div class="card-img"><img src="/wp-content/card/cardimage/dmx-001a.jpg"></div></div><div class="cardDetail"><h3 class="card-name">表 / 呪文<span class="packname">(DMX 1/2)</span></h3><div class="card-img"><img src=""></div><img src="/common/img/parts/ico_twitter@2x.png"></div><div class="productCard"></div>`
  const faces = extractOfficialCardFaces(twinPact, 'https://dm.takaratomy.co.jp/card/detail/?id=dmx-001')
  assert.equal(faces.length, 1)
  assert.match(faces[0].image_url, /cardimage\/dmx-001a\.jpg$/)
})

test('official placeholder face names are marked for review', () => {
  assert.equal(isSuspiciousFaceName('{撃墜王ガイアール・キラードラゴン} Bottom'), true)
  assert.equal(isSuspiciousFaceName('伝説の禁断 ドキンダムX'), false)
})

test('parser v4 fixed fixtures cover one, two, three, psychic, dragheart, forbidden and zero dragon faces', () => {
  assert.equal(PARSER_VERSION, 4)
  const fixtures = [
    { label: 'normal one face', expected: 1, html: detail({ name: '通常カード', image: '/wp-content/card/cardimage/fix-one.jpg' }) },
    { label: 'normal two faces', expected: 2, html: detail({ name: '表面', image: '/wp-content/card/cardimage/fix-two-a.jpg' }) + detail({ name: '裏面', image: '/wp-content/card/cardimage/fix-two-b.jpg' }) },
    { label: 'normal three faces', expected: 3, html: detail({ name: '第一形態', image: '/wp-content/card/cardimage/fix-three-a.jpg' }) + detail({ name: '第二形態', image: '/wp-content/card/cardimage/fix-three-b.jpg' }) + detail({ name: '第三形態', image: '/wp-content/card/cardimage/fix-three-c.jpg' }) },
    { label: 'psychic', expected: 2, html: detail({ name: '時空の表面', image: '/wp-content/card/cardimage/fix-psy-a.jpg', type: 'サイキック・クリーチャー' }) + detail({ name: '覚醒の裏面', image: '/wp-content/card/cardimage/fix-psy-b.jpg', type: 'サイキック・クリーチャー' }) },
    { label: 'dragheart', expected: 2, html: detail({ name: '龍解前', image: '/wp-content/card/cardimage/fix-drag-a.jpg', type: 'ドラグハート・ウエポン' }) + detail({ name: '龍解後', image: '/wp-content/card/cardimage/fix-drag-b.jpg', type: 'ドラグハート・クリーチャー' }) },
    { label: 'forbidden', expected: 2, html: detail({ name: '禁断 ～封印されしX～', image: '/wp-content/card/cardimage/fix-kindan-a.jpg', type: '禁断の鼓動' }) + detail({ name: '伝説の禁断 ドキンダムX', image: '/wp-content/card/cardimage/fix-kindan-b.jpg', type: '禁断クリーチャー' }) },
    { label: 'zero dragon', expected: 2, html: detail({ name: '零龍の儀', image: '/wp-content/card/cardimage/fix-zero-a.jpg', type: '零龍の儀' }) + detail({ name: '零龍', image: '/wp-content/card/cardimage/fix-zero-b.jpg', type: '零龍クリーチャー' }) },
  ]
  for (const fixture of fixtures) {
    const faces = extractOfficialCardFaces(`${fixture.html}<div class="productCard"></div>`, pageUrl)
    assert.equal(faces.length, fixture.expected, fixture.label)
    assertFaceBasics(faces)
  }
})

test('same-name faces remain separate when their official images differ', () => {
  const faces = extractOfficialCardFaces(`${detail({ name: '同じ名前', image: '/wp-content/card/cardimage/same-a.jpg' })}${detail({ name: '同じ名前', image: '/wp-content/card/cardimage/same-b.jpg' })}`, pageUrl)
  assert.equal(faces.length, 2)
  assert.equal(new Set(faces.map((face) => face.name)).size, 1)
  assertFaceBasics(faces)
})

test('truncated official HTML still returns only the complete card detail', () => {
  const truncated = `${detail({ name: '完全な面', image: '/wp-content/card/cardimage/complete.jpg' })}<div class="cardDetail"><h3 class="card-name">欠けた面`
  const faces = extractOfficialCardFaces(truncated, pageUrl)
  assert.equal(faces.length, 1)
  assert.equal(faces[0].name, '完全な面')
})
