import test from 'node:test'
import assert from 'node:assert/strict'
import { contentHash, extractOfficialCardFaces } from '../scripts/cards/card-face-extraction.mjs'

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
})

test('content hash is stable and content-sensitive', () => {
  assert.equal(contentHash(html), contentHash(html))
  assert.notEqual(contentHash(html), contentHash(`${html} `))
})
