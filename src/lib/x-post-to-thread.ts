import { createHash } from 'node:crypto'

/**
 * X投稿テキストからスレッドタイトルを生成する
 * - 先頭1〜4行を使う
 * - 「優勝」「選手権」「カード選手権」を含む行でストップ
 * - 改行除去・40文字上限
 */
export function generateTitleFromXPost(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return text.slice(0, 40)

  const stopKeywords = ['優勝', '選手権', 'カード選手権']
  const titleLines: string[] = []

  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    titleLines.push(lines[i])
    if (stopKeywords.some(kw => lines[i].includes(kw))) break
  }

  return titleLines.join('').replace(/\s+/g, '').slice(0, 40)
}

/**
 * X投稿テキストからカテゴリスラグを推定する
 * マッチしない場合は 'casual' を返す
 */
export function detectCategorySlugFromXPost(text: string): string {
  if (/デュエプレ|デュエルマスターズプレイス/.test(text)) return 'dueplace'
  if (/アニメ|漫画/.test(text)) return 'anime'
  if (/デュエパ|特殊ルール/.test(text)) return 'duepa'
  if (/高騰|下落|値段|相場|買取/.test(text)) return 'price'
  if (/CS|大会|環境|トップメタ/.test(text)) return 'cs'
  if (/デッキ相談|デッキレシピ|コンボ|構築/.test(text)) return 'deck'
  if (/新弾|新カード|収録|パック/.test(text)) return 'card'
  return 'casual'
}

/**
 * テキストの SHA-256 ハッシュを返す（重複防止用）
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex')
}
