export const RESUME_DRAFT_STORAGE_KEY = 'duema-bbs:resume-maker:draft:v1'

export const RESUME_STEPS = [
  { id: 1, label: '基本情報' },
  { id: 2, label: 'デュエマ歴' },
  { id: 3, label: '実績・完成' },
] as const

export const RESUME_SITE_FOOTER = { siteName: 'デュエマ掲示板', url: 'https://www.duema-bbs.com', hashtag: '#デュエマ履歴書' } as const
export const RESUME_SHARE_TEXT = 'デュエマ履歴書を書きました'
