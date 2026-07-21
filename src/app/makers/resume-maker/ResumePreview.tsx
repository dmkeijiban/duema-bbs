'use client'

import { useEffect, useRef, useState } from 'react'
import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_SOCIAL_TAG_PRESETS,
  type ResumeData,
} from '@/lib/maker-resume'

const PREVIEW_WIDTH = 794
const PREVIEW_HEIGHT = 1123

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full border border-slate-400 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-800">{children}</span>
}

function DefaultAvatarGlyph() {
  return (
    <svg className="h-1/2 w-1/2 text-slate-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
}

function FieldRow({ cells }: { cells: [string, string][] }) {
  return (
    <div className="grid divide-x divide-slate-400 border-b border-slate-400 last:border-b-0" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
      {cells.map(([label, value]) => (
        <div key={label} className="flex min-w-0">
          <div className="w-[86px] shrink-0 border-r border-slate-400 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-600">{label}</div>
          <div className="min-w-0 flex-1 truncate px-2 py-2 text-sm font-bold">{value}</div>
        </div>
      ))}
    </div>
  )
}

export function ResumePreview({ data, avatarUrl }: { data: ResumeData; avatarUrl: string | null }) {
  const createdAtLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date())
  const achievementLabels = data.achievements.map(key => RESUME_ACHIEVEMENT_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)
  const socialLabels = data.socialTags.map(key => RESUME_SOCIAL_TAG_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)

  return (
    <div style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }} className="shrink-0 border-2 border-slate-800 bg-[#fdfdfb] p-8 font-serif text-slate-900">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <h1 className="text-4xl font-black tracking-wide">デュエマ履歴書</h1>
        <p className="mt-2 text-xs text-slate-600">作成日　{createdAtLabel}</p>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="flex-1 border border-slate-400">
          <FieldRow cells={[['名前', data.handleName || '未入力']]} />
          <FieldRow cells={[['開始時期', data.startedAt || '-'], ['活動地域', data.region || '-']]} />
          <FieldRow cells={[['性別', data.gender], ['年齢', data.ageGroup], ['デュエプレ', data.playsDuelMastersPlay]]} />
          <FieldRow cells={[['好きな文明', data.favoriteCivilization || '-'], ['プレイスタイル', data.playStyle || '-']]} />
        </div>
        <div className="h-[150px] w-[150px] shrink-0 overflow-hidden border-2 border-slate-800 bg-slate-100">
          {avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><DefaultAvatarGlyph /></div>}
        </div>
      </div>

      <section className="mt-4">
        <FieldRow cells={[['使用デッキ', data.currentDecksText || '-']]} />
        <div className="border-x border-b border-slate-400">
          <FieldRow cells={[['好きなYouTuber', data.favoriteYouTuber || '-'], ['好きな事', data.otherInterests || '-']]} />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">大会・デュエマ実績</h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{achievementLabels.length ? achievementLabels.map(label => <Chip key={label}>{label}</Chip>) : <span className="text-xs text-slate-400">（未選択）</span>}</div>
        {data.achievementNote && <p className="mt-1.5 text-xs">{data.achievementNote}</p>}
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">フリースペース</h2>
        <div className="mt-1.5 min-h-[90px] whitespace-pre-wrap break-words border border-slate-400 p-2 text-xs leading-relaxed">{data.freeSpace || '（未入力）'}</div>
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">対戦・交流について</h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{socialLabels.length ? socialLabels.map(label => <Chip key={label}>{label}</Chip>) : <span className="text-xs text-slate-400">（未選択）</span>}</div>
        {data.socialNote && <p className="mt-1.5 text-xs">{data.socialNote}</p>}
      </section>

      <p className="mt-3 text-center text-[10px] text-slate-400">デュエマ掲示板　https://www.duema-bbs.com　#デュエマ履歴書</p>
    </div>
  )
}

export function ScaledResumePreview({ data, avatarUrl, className }: { data: ResumeData; avatarUrl: string | null; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setScale(Math.min(1, element.clientWidth / PREVIEW_WIDTH))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className} style={{ height: PREVIEW_HEIGHT * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}>
        <ResumePreview data={data} avatarUrl={avatarUrl} />
      </div>
    </div>
  )
}
