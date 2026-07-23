import { test, expect, type Locator } from '@playwright/test'

const CLICK_INTERVAL_MS = 25

async function clickRapidlyAndRecordSequence(button: Locator, countLabel: Locator, times: number) {
  const sequence: string[] = []
  for (let index = 0; index < times; index += 1) {
    await button.click()
    sequence.push(await countLabel.textContent() ?? '')
    await new Promise(resolve => setTimeout(resolve, CLICK_INTERVAL_MS))
  }
  return sequence
}

test.describe('デッキメーカー：カード詳細モーダルの＋／−高速連打', () => {
  test('＋を20〜30ms間隔で4連打すると1回も抜けずに0→1→2→3→4になる', async ({ page }) => {
    await page.goto('/makers/deck-maker')

    const results = page.getByTestId('search-results')
    const firstResult = results.locator('article').first()
    await expect(firstResult).toBeVisible({ timeout: 15_000 })
    await firstResult.locator('button').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const addButton = dialog.getByRole('button', { name: /1枚増やす/ })
    const removeButton = dialog.getByRole('button', { name: /1枚減らす/ })
    const countLabel = dialog.locator('[aria-live="polite"] span')

    await expect(countLabel).toHaveText('0')

    // 20〜30ms間隔で＋を4連打 → 1回も抜けずに 0→1→2→3→4 を通過すること
    const addSequence = await clickRapidlyAndRecordSequence(addButton, countLabel, 4)
    expect(addSequence).toEqual(['1', '2', '3', '4'])
    await expect(countLabel).toHaveText('4')

    // 連打直後（遅延バッチ処理を挟まず）に実データ側（デッキ表示）も4枚に反映されていること
    await expect(page.getByTestId('deck-count')).toHaveText('4/40', { timeout: 100 })

    // 実データ（localStorage）も4になっていること
    const deckAfterAdd = await page.evaluate(() => {
      const raw = localStorage.getItem('duema-bbs:deck-maker')
      return raw ? JSON.parse(raw) : null
    })
    expect(deckAfterAdd?.entries?.[0]?.count).toBe(4)

    // モーダルを閉じても表示枚数と実データがズレないこと
    await page.getByRole('button', { name: 'カード操作を閉じる' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('deck-count')).toHaveText('4/40')

    // 再度開いても4のままであること
    await firstResult.locator('button').click()
    await expect(dialog).toBeVisible()
    await expect(countLabel).toHaveText('4')

    // −を20〜30ms間隔で4連打 → 1回も抜けずに 4→3→2→1→0 を通過すること
    const removeSequence = await clickRapidlyAndRecordSequence(removeButton, countLabel, 4)
    expect(removeSequence).toEqual(['3', '2', '1', '0'])
    await expect(countLabel).toHaveText('0')

    await page.getByRole('button', { name: 'カード操作を閉じる' }).click()
    await expect(page.getByTestId('deck-count')).toHaveText('0/40')

    const deckAfterRemove = await page.evaluate(() => {
      const raw = localStorage.getItem('duema-bbs:deck-maker')
      return raw ? JSON.parse(raw) : null
    })
    expect(deckAfterRemove?.entries?.length ?? 0).toBe(0)
  })

  test('検索結果を複数表示している状態でも4連打が1回も抜けずに反映される', async ({ page }) => {
    await page.goto('/makers/deck-maker')

    const results = page.getByTestId('search-results')
    await expect(results.locator('article').nth(2)).toBeVisible({ timeout: 15_000 })

    // 他のカードの検索結果表示は維持されたまま、3枚目のカードを操作する
    const thirdResult = results.locator('article').nth(2)
    await thirdResult.locator('button').click()

    const dialog = page.getByRole('dialog')
    const addButton = dialog.getByRole('button', { name: /1枚増やす/ })
    const countLabel = dialog.locator('[aria-live="polite"] span')

    const addSequence = await clickRapidlyAndRecordSequence(addButton, countLabel, 4)
    expect(addSequence).toEqual(['1', '2', '3', '4'])
    await expect(countLabel).toHaveText('4')

    // 検索結果一覧は消えず維持されていること
    await expect(results.locator('article')).toHaveCount(3)
  })
})
