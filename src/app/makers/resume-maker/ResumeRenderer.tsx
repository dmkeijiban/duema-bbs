'use client'

import type { Ref } from 'react'
import type { ResumeData } from '@/lib/maker-resume'
import { FullscreenResumePreview, ResumePreview, ScaledResumePreview } from './ResumePreview'

type BaseProps = { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null }

/** 見やすさ重視レイアウトは廃止し、すべて標準レイアウトで描画する。 */
export function ResumeRenderer({ data, avatarUrl, resumeDate, exportRef }: BaseProps & { exportRef?: Ref<HTMLDivElement> }) {
  return <ResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} exportRef={exportRef} />
}

export function ScaledResumeRenderer({ data, avatarUrl, resumeDate, className }: BaseProps & { className?: string }) {
  return <ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
}

export function FullscreenResumeRenderer({ data, avatarUrl, resumeDate, className }: BaseProps & { className?: string }) {
  return <FullscreenResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className={className} />
}
