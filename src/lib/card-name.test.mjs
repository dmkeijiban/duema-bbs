import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCardName, normalizeCardSearch } from './card-name.ts'
test('カード名正規化',()=>{assert.equal(normalizeCardName(' ボルシャック　／　ドラゴン · 改 '),'ボルシャック/ドラゴン・改');assert.equal(normalizeCardSearch('ＤＥＡＴＨ・ドラゴン'),'death・ドラゴン')})
