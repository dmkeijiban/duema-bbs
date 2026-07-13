import { readFile } from 'node:fs/promises'

const cards = JSON.parse(await readFile(new URL('./dm26-ex2-standard-89.import-candidates.json', import.meta.url), 'utf8'))
const expectedSpr = Array.from({ length: 5 }, (_, index) => `SPR${index + 1}/SPR5`)
const errors = []
const ids = cards.map(card => `dm26-ex2-${card.card_number.replace('/', '-')}`)
const numbers = cards.map(card => card.card_number)

if (cards.length !== 94) errors.push(`expected 94 cards, got ${cards.length}`)
if (new Set(ids).size !== ids.length) errors.push('duplicate stable ID')
if (new Set(numbers).size !== numbers.length) errors.push('duplicate card_number')
if (expectedSpr.some((number, index) => numbers[index] !== number)) errors.push('SPR1/SPR5〜SPR5/SPR5 must be first and complete')

for (const [index, card] of cards.entries()) {
  if (!card.card_name?.trim()) errors.push(`row ${index + 1}: missing card_name`)
  if (!card.card_number?.trim()) errors.push(`row ${index + 1}: missing card_number`)
  if (!card.image_url?.startsWith('https://dm.takaratomy.co.jp/')) errors.push(`row ${index + 1}: invalid image_url`)
  if (/\bNew!\b/i.test(card.card_name)) errors.push(`row ${index + 1}: display marker leaked into card_name`)
}

if (process.argv.includes('--check-images')) {
  const results = await Promise.all(cards.map(async card => {
    try {
      const response = await fetch(card.image_url, { method: 'HEAD', redirect: 'follow' })
      return response.ok ? null : `${card.card_number}: HTTP ${response.status}`
    } catch (error) {
      return `${card.card_number}: ${error instanceof Error ? error.message : 'request failed'}`
    }
  }))
  errors.push(...results.filter(Boolean))
}

console.log(JSON.stringify({ cards: cards.length, spr: numbers.slice(0, 5), unique_ids: new Set(ids).size, unique_numbers: new Set(numbers).size, errors }, null, 2))
if (errors.length) process.exitCode = 1
