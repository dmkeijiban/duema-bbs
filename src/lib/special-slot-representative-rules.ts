import type { SpecialSlotKey } from '@/lib/special-slot-options'

/**
 * dormageddon/zeroryuの代表カードを実カタログから一意に特定するための識別条件。
 * この定数は supabase/migrations/20260724190000_special_slot_representatives.sql の
 * SQL（`card_type = '...'`）と完全に一致させること — special-slot-representative-rules.test.ts
 * がマイグレーションファイルの文字列とこの定数の値が一致することを検証する。
 *
 * card_type は cards テーブル自身（論理カードの主面タイプ。card_faces経由ではない）
 * を対象にする。これにより：
 *   - dormageddon: 「FORBIDDEN STAR ～世界最後の日～／終焉の禁断 ドルマゲドンX」
 *     ツインパクトの表面タイプ '最終禁断フィールド' に一致する論理カード（normalized_name
 *     がユニーク制約のため、再録があっても同一cards.idに集約される）
 *   - zeroryu: 「零龍」単独カタログ登録カードの主面タイプ '零龍クリーチャー' に一致する
 *     論理カード。"○○の儀"系ツインパクトは表面タイプが零龍の儀／零龍星雲であり
 *     cards.card_type は零龍クリーチャーにならないため、それらの裏面重複は対象外になる。
 */
export const SPECIAL_SLOT_REPRESENTATIVE_RULES: Record<SpecialSlotKey, { cardType: string; label: string }> = {
  dormageddon: { cardType: '最終禁断フィールド', label: 'ドルマゲドン' },
  zeroryu: { cardType: '零龍クリーチャー', label: '零龍' },
}

export type RepresentativeCandidateRow = { id: string; card_type: string | null; deck_zone_class: string | null; is_active: boolean }

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
  const matches = rows.filter(row => row.card_type === rule.cardType && row.deck_zone_class === 'special' && row.is_active)
  if (matches.length === 0) return { ok: false, reason: 'not_found', count: 0 }
  if (matches.length > 1) return { ok: false, reason: 'multiple_matches', count: matches.length }
  return { ok: true, cardId: matches[0].id }
}
