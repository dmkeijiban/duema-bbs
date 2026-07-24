import type { SpecialSlotKey } from '@/lib/special-slot-options'

/**
 * dormageddon/zeroryuの代表カードを実カタログから一意に特定するための識別条件。
 * この定数は supabase/migrations/20260724190000_special_slot_representatives.sql の
 * SQLと完全に一致させること — special-slot-representative-rules.test.ts が
 * マイグレーションファイルの文字列とこの定数の値が一致することを検証する。
 *
 * - dormageddon: cards.card_type = '最終禁断フィールド' のみで一意に絞り込める。
 *   本番の /api/cards/search を通じた読み取り専用確認（2026-07-24実施）で、
 *   「FORBIDDEN STAR ～世界最後の日～／終焉の禁断 ドルマゲドンX」ツインパクト
 *   （cards.id=c87706ba-a6a1-49da-923f-68bb7c8e681c）の1件のみが該当することを
 *   確認済み。
 *
 * - zeroryu: 当初 cards.card_type = '零龍クリーチャー' で絞り込める想定だったが、
 *   同じ本番確認で **この条件に一致する行は0件** であることが判明した。「零龍」は
 *   "○○の儀"系ツインパクト5種（滅亡の起源 零無／破壊の儀×2／夢幻の起源など、
 *   dmbd22-001〜005）の裏面としてのみ存在し、cards自身のcard_typeは表面の
 *   零龍の儀／零龍星雲のままで、いずれも対等な別の論理カード（別cards.id）。
 *   スキーマだけからは一意に決定できないため、担当者に候補5件を提示して確認した
 *   結果、最初のリリース（dmbd22-001「滅亡の起源 零無」、card_id
 *   d0dab9d1-8c2a-49e0-8837-33d33953e973）を代表として採用することが確定した。
 *   このため zeroryu だけは card_type に加えて、この1枚の card_printings.source_key
 *   （'dmbd22-001'）でも絞り込む。
 */
export const SPECIAL_SLOT_REPRESENTATIVE_RULES: Record<SpecialSlotKey, { cardType: string; label: string; sourceKey?: string }> = {
  dormageddon: { cardType: '最終禁断フィールド', label: 'ドルマゲドン' },
  zeroryu: { cardType: '零龍の儀', label: '零龍', sourceKey: 'dmbd22-001' },
}

export type RepresentativeCandidateRow = {
  id: string
  card_type: string | null
  deck_zone_class: string | null
  is_active: boolean
  /** そのcards.idに紐づく、いずれかのcard_printings.source_key。zeroryuの絞り込みにのみ使う。 */
  source_key?: string | null
}

export type RepresentativeResolution =
  | { ok: true; cardId: string }
  | { ok: false; reason: 'not_found' | 'multiple_matches'; count: number }

/**
 * SQLマイグレーションの `select ... into strict` と同じ判定をJSで再現したもの
 * （0件→not_found、2件以上→multiple_matches、1件のみ→ok）。マイグレーション自体は
 * node:testで直接実行できないため、この純粋関数をテストすることで識別条件の
 * 「必ず1件に絞り込む」契約を検証する。
 */
export function resolveRepresentative(rows: RepresentativeCandidateRow[], key: SpecialSlotKey): RepresentativeResolution {
  const rule = SPECIAL_SLOT_REPRESENTATIVE_RULES[key]
  const matches = rows.filter(row =>
    row.card_type === rule.cardType
    && row.deck_zone_class === 'special'
    && row.is_active
    && (rule.sourceKey == null || row.source_key === rule.sourceKey),
  )
  if (matches.length === 0) return { ok: false, reason: 'not_found', count: 0 }
  if (matches.length > 1) return { ok: false, reason: 'multiple_matches', count: matches.length }
  return { ok: true, cardId: matches[0].id }
}
