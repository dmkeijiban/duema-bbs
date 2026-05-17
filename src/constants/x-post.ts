/**
 * x_posts テーブルで使う定数の一元管理
 * XPostForm / PostListClient / actions など全ファイルからここを参照する
 */

// ----------------------------------------------------------------
// 投稿種別
// ----------------------------------------------------------------
export const POST_TYPE_DEFS = [
  { value: 'win',        label: '優勝🏆',           shortLabel: '優勝🏆' },
  { value: 'roujinkai', label: 'デュエマ老人会',   shortLabel: '老人会' },
  { value: 'iwakan',    label: 'デュエマ違和感',   shortLabel: '違和感' },
  { value: 'silhouette',label: 'シルエット選手権', shortLabel: 'シルエット' },
  { value: 'kurekore',  label: '黒歴史デュエマ',   shortLabel: '黒歴史' },
  { value: 'giron',     label: 'デュエマ物議',     shortLabel: '物議' },
  { value: 'share',     label: '掲示板共有',       shortLabel: '掲示板共有' },
  { value: 'kouton',    label: '高騰下落情報',     shortLabel: '高騰下落' },
  { value: 'custom',    label: 'カスタム',         shortLabel: 'カスタム' },
] as const

export type PostTypeValue = (typeof POST_TYPE_DEFS)[number]['value']

// ----------------------------------------------------------------
// ステータス
// ----------------------------------------------------------------
export const STATUS_DEFS = [
  { value: 'draft',             label: '下書き',              formLabel: '下書き',                color: 'bg-gray-100 text-gray-600' },
  { value: 'typefully_drafted', label: 'Typefully済',         formLabel: 'Typefully下書き済み',    color: 'bg-blue-100 text-blue-700' },
  { value: 'scheduled',         label: '予約済み',            formLabel: '予約済み',              color: 'bg-indigo-100 text-indigo-700' },
  { value: 'posted',            label: '投稿済み',            formLabel: '投稿済み',              color: 'bg-green-100 text-green-700' },
  { value: 'error',             label: 'エラー',              formLabel: 'エラー',                color: 'bg-red-100 text-red-700' },
] as const

export type StatusValue = (typeof STATUS_DEFS)[number]['value']

// ----------------------------------------------------------------
// クイックルックアップ（badge表示・フィルタ用）
// ----------------------------------------------------------------
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  POST_TYPE_DEFS.map((t) => [t.value, t.shortLabel]),
)
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_DEFS.map((s) => [s.value, s.label]),
)
export const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  STATUS_DEFS.map((s) => [s.value, s.color]),
)
export const ALL_STATUSES = STATUS_DEFS.map((s) => s.value)
export const ALL_TYPES    = POST_TYPE_DEFS.map((t) => t.value)

// フォームドロップダウン用（label は正式名称）
export const POST_TYPES = POST_TYPE_DEFS.map((t) => ({ value: t.value, label: t.label }))
export const STATUSES   = STATUS_DEFS.map((s) => ({ value: s.value, label: s.formLabel }))
