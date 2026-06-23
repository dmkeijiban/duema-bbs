import type { createAdminClient } from '@/lib/supabase-admin'

/**
 * 退会・アカウント再開時に、本人の投稿系コンテンツから user_id を外して匿名化する共通処理。
 *
 * 公開投稿者ページ・通常/キャンペーンランキングが、退会前の活動実績を本人に
 * 再び結びつけないようにするために使う。アカウント再開（profiles のフラグを戻す）
 * を行う前にこの匿名化を完了させることで、「プロフィールは再利用できるが、
 * 退会前の投稿実績は復活しない」を保証する。
 *
 * 安全条件:
 * - 対象は指定ユーザー本人のみ（eq user_id）。全ユーザーへの一括更新はしない。
 * - 本文・画像・session_id・スコアなどコンテンツ本体は一切変更しない（user_id のみ null 化）。
 * - 物理削除はしない。
 * - 冪等。既に null 化済みの行は対象に含まれないだけで、再実行しても壊れない。
 * - いずれかのテーブルで失敗したら即座に中断してエラーを返す。呼び出し側は
 *   このエラー時に withdrawn_at を解除しない（＝再開を完了させない）こと。
 *
 * 対象テーブルはいずれも user_id が nullable（auth.users on delete set null）で、
 * zukan_card_ratings の unique 制約も UNIQUE (card_id, user_id) のため NULL は
 * 重複扱いされない。よって user_id を null 化しても制約違反は起きない。
 */
const ANONYMIZE_TABLES = [
  'posts',
  'threads',
  'zukan_card_ratings',
  'zukan_card_reviews',
  'zukan_pack_reviews',
] as const

export async function anonymizeUserContent(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ error?: string; failedTable?: string }> {
  for (const table of ANONYMIZE_TABLES) {
    const { error } = await admin
      .from(table)
      .update({ user_id: null })
      .eq('user_id', userId)

    if (error) {
      console.error(`Failed to anonymize ${table} for user ${userId}:`, error.message)
      return { error: error.message, failedTable: table }
    }
  }

  return {}
}
