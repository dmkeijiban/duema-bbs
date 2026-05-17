/**
 * SNS リンク定数（クライアント・サーバー共用）
 * デフォルト値。管理画面（/admin）の「SNS URL設定」で上書き可能。
 * サーバーサイドでの動的取得は @/lib/sns-server を使うこと。
 */
export const SNS = {
  x: 'https://x.com/dmkeijiban',
  youtube: 'https://www.youtube.com/@darekanizatugaku/videos',
  discord: 'https://discord.gg/HEmmmDZe',
} as const

export type SnsUrls = {
  x: string
  youtube: string
  discord: string
}
