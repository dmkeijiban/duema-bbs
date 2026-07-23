'use client'

import type { ResumeLayoutType } from '@/lib/maker-resume'

/** 見やすさ重視レイアウト廃止後の互換用。既存呼び出し元では何も表示しない。 */
export function ResumeLayoutToggle(_props: {
  value: ResumeLayoutType
  onChange: (next: ResumeLayoutType) => void
  heading?: string | null
  compact?: boolean
}) {
  return null
}
