import { createHash } from 'node:crypto'

const TITLE_MAX_LEN = 40

const SENTENCE_ENDINGS = '。！？!?」』）)'
const CLAUSE_BREAKS = '、，,・…　 '

/**
 * テキストを上限文字数で「いい感じ」に切って、途中で途切れない文にする。
 * 1. 上限内に文末（。！？!?」』 等）があれば、その直後で切る（完結した文になる）
 * 2. 文末が無ければ読点・区切り（、，・ 空白 等）で切って末尾に … を付ける
 * 3. それも無ければ上限で切って … を付ける
 *
 * 短すぎる位置（上限の40%未満）での区切りは採用せず、より長く取る。
 */
function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text

  const head = text.slice(0, maxLen)
  const minLen = Math.floor(maxLen * 0.4)

  // 1) 文末で切る（完結した文を優先）
  let lastEnd = -1
  for (let i = 0; i < head.length; i++) {
    if (SENTENCE_ENDINGS.includes(head[i])) lastEnd = i
  }
  if (lastEnd >= minLen) {
    return head.slice(0, lastEnd + 1)
  }

  // 2) 読点・区切りで切って … を付ける
  let lastBreak = -1
  for (let i = 0; i < head.length; i++) {
    if (CLAUSE_BREAKS.includes(head[i])) lastBreak = i
  }
  if (lastBreak >= minLen) {
    const cut = head.slice(0, lastBreak).replace(/[、，,・…　\s]+$/u, '')
    if (cut.length > 0) return cut + '…'
  }

  // 3) ハードカット（末尾の中途半端な空白は除去）+ …
  return head.replace(/\s+$/u, '') + '…'
}

/**
 * X投稿テキストからスレッドタイトルを生成する
 * - ハッシュタグ（#xxx）を除去してからタイトル化
 * - 先頭1〜4行を使う
 * - 「優勝」「選手権」「カード選手権」を含む行でストップ
 * - 改行除去・40文字上限（上限を超える場合は文末/区切りで自然に切る）
 */
export function generateTitleFromXPost(text: string): string {
  // ハッシュタグ（#で始まる単語）を除去
  const stripped = text.replace(/#\S+/g, '').trim()

  const lines = stripped.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return smartTruncate(stripped, TITLE_MAX_LEN)

  const stopKeywords = ['優勝', '選手権', 'カード選手権']
  const titleLines: string[] = []

  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    titleLines.push(lines[i])
    if (stopKeywords.some(kw => lines[i].includes(kw))) break
  }

  return smartTruncate(titleLines.join('').replace(/\s+/g, ''), TITLE_MAX_LEN)
}

/**
 * X由来のハッシュタグ（例：#デュエマ、#デュエルマスターズ 等）は掲示板本文には入れない。
 * 本文に含まれる場合は削除する。掲示板ではハッシュタグに意味がないため、
 * 自然な文章として読める形に整える。
 */
export function sanitizeXPostForForumBody(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#[\p{L}\p{N}_ー一-龠ぁ-んァ-ヶ]+/gu, '')
    .replace(/DMPの人はリポスト・フォローお願いします。?/g, '')
    .replace(/毎晩\d{1,2}時開催です。?/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
