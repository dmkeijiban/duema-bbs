export const USER_RANKING_THREAD_POINT = 3
export const USER_RANKING_POST_POINT = 2
export const USER_RANKING_CARD_RATING_POINT = 1
export const USER_RANKING_CARD_REVIEW_POINT = 2
export const USER_RANKING_PACK_REVIEW_POINT = 2

// 全ランキング共通の「1ユーザー1日あたり最大ポイント」上限。
// この開始日(JST)以降の活動分にのみ適用し、それ以前は従来計算（上限なし）のまま。
// ユーザー向け画面には表示しない内部仕様。
export const RANKING_DAILY_TOTAL_CAP = 24
export const RANKING_DAILY_CAP_START_DATE_JST = '2026-06-26'

// Campaign-specific constants (do not use for public ranking)
export const CAMPAIGN_THREAD_POINT = 3
export const CAMPAIGN_THREAD_DAILY_LIMIT = 3
export const CAMPAIGN_POST_POINT = 2
export const CAMPAIGN_POST_DAILY_LIMIT = 3
export const CAMPAIGN_REVIEW_POINT = 2
export const CAMPAIGN_REVIEW_DAILY_LIMIT = 3
export const CAMPAIGN_RATING_DAILY_LIMIT = 3
export const CAMPAIGN_THREAD_CONTRIB_POINT = 1
export const CAMPAIGN_THREAD_CONTRIB_DAILY_LIMIT = 3
