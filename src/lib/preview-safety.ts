const PREVIEW_PROJECT_REF = 'ibhnzvndgciqoexnytmp'
const PRODUCTION_PROJECT_REF = 'nodgfukqvuwvgfnlzvnh'

function extractProjectRef(value: string | undefined) {
  if (!value) return null
  const match = value.match(/(?:postgres(?:ql)?:\/\/[^@]+@|https:\/\/)([a-z0-9]+)(?:\.|:)/i)
  if (match?.[1]) return match[1]
  if (value.includes(PREVIEW_PROJECT_REF)) return PREVIEW_PROJECT_REF
  if (value.includes(PRODUCTION_PROJECT_REF)) return PRODUCTION_PROJECT_REF
  return null
}

export function assertPreviewDatabaseTarget() {
  if (process.env.VERCEL_ENV !== 'preview') {
    throw new Error('Preview環境でのみ保存できます')
  }

  const values = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_DB_URL,
  ]

  if (values.some(value => value?.includes(PRODUCTION_PROJECT_REF))) {
    throw new Error('Production Supabaseへの接続を検出したため保存を拒否しました')
  }

  const refs = values.map(extractProjectRef).filter(Boolean)
  if (!refs.includes(PREVIEW_PROJECT_REF)) {
    throw new Error('許可されたPreview Supabaseへ接続されていません')
  }
}
