'use client'

import type { Ref } from 'react'
import type { ResumeData } from '@/lib/maker-resume'
import { FullscreenResumePreview, ResumePreview, ScaledResumePreview } from './ResumePreview'
import { FullscreenVisualResumePreview, ScaledVisualResumePreview, VisualResumePreview } from './VisualResumePreview'

type BaseProps = { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null }

/**
 * 履歴書の layoutType に応じて標準/見やすさ重視レイアウトの描画を振り分ける。
 * メーカーのプレビュー・完成モーダル・マイページ・一覧・詳細・PNG書き出しは、すべてこのコンポーネント経由で描画する。
 * 標準レイアウト（ResumePreview）の見た目はここでは一切変更しない。
 */
export function ResumeRenderer({ data, avatarUrl, resumeDate, exportRef }: BaseProps & { exportRef?: Ref<HTMLDivElement> }) {
  if (data.layoutType === 'visual') return <VisualResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} exportRef={exportRef} />
  return <ResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} exportRef={exportRef} />
}

export function ScaledResumeRenderer({ data, avatarUrl, resumeDate, className }: BaseProps & { className?: string }) {
  if (data.layoutType === 'visual') return <ScaledVisualResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
  return <ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
}

export function FullscreenResumeRenderer({ data, avatarUrl, resumeDate, className }: BaseProps & { className?: string }) {
  if (data.layoutType === 'visual') return <FullscreenVisualResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
  return <FullscreenResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
}
