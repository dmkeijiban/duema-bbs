'use client'

import { useEffect, useRef, useState } from 'react'
import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_MAX_DECK_ROWS,
  RESUME_MAX_HISTORY_ROWS,
  RESUME_PHOTO_CAPTION_LABELS,
  RESUME_SOCIAL_TAG_PRESETS,
  type ResumeData,
} from '@/lib/maker-resume'

const PREVIEW_WIDTH = 794
const PREVIEW_HEIGHT = 1123

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full border border-slate-400 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-800">{children}</span>
}

export function ResumePreview({ data, avatarUrl, photoImageUrl }: { data: ResumeData; avatarUrl: string | null; photoImageUrl: string | null }) {
  const createdAtLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date())
  const historyRows = Array.from({ length: RESUME_MAX_HISTORY_ROWS }, (_, index) => data.history[index] ?? { period: '', content: '' })
  const deckRows = Array.from({ length: RESUME_MAX_DECK_ROWS }, (_, index) => data.deckHistory[index] ?? { period: '', deckName: '' })
  const achievementLabels = data.achievements.map(key => RESUME_ACHIEVEMENT_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)
  const socialLabels = data.socialTags.map(key => RESUME_SOCIAL_TAG_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)
  const photoUrl = data.photo?.type === 'avatar' ? avatarUrl : data.photo?.type === 'card' ? photoImageUrl : null
  const photoCaption = data.photo?.type === 'card' ? RESUME_PHOTO_CAPTION_LABELS[data.photo.caption] : null

  return (
    <div style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }} className="shrink-0 border-2 border-slate-800 bg-[#fdfdfb] p-8 font-serif text-slate-900">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <h1 className="text-4xl font-black tracking-wide">デュエマ履歴書</h1>
        <p className="mt-2 text-xs text-slate-600">作成日　{createdAtLabel}</p>
      </div>

      <div className="mt-4 flex gap-4">
        <table className="w-full flex-1 border-collapse text-sm">
          <tbody>
            {[
              ['ハンドルネーム', data.handleName || '未入力'],
              ['デュエマ開始時期', data.startedAt || '-'],
              ['活動地域', data.region || '-'],
              ['好きな文明', data.favoriteCivilization || '-'],
              ['プレイスタイル', data.playStyle || '-'],
            ].map(([label, value]) => (
              <tr key={label} className="border border-slate-400">
                <th className="w-32 border-r border-slate-400 bg-slate-50 px-2 py-2 text-left text-xs font-bold text-slate-600">{label}</th>
                <td className="px-3 py-2 font-bold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="w-[150px] shrink-0">
          <div className="flex h-[168px] w-[150px] items-center justify-center border-2 border-slate-800 bg-slate-100">
            {photoUrl ? <img src={photoUrl} alt="証明写真" className="h-full w-full object-cover" /> : <span className="text-[11px] text-slate-400">証明写真</span>}
          </div>
          {photoCaption && <p className="mt-1 text-center text-[10px] font-bold text-slate-700">{photoCaption}</p>}
        </div>
      </div>

      <section className="mt-4">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">デュエマ歴</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead><tr className="border border-slate-400 bg-slate-50"><th className="w-28 border-r border-slate-400 px-2 py-1">時期</th><th className="px-2 py-1 text-left">内容</th></tr></thead>
          <tbody>{historyRows.map((row, index) => <tr key={index} className="border border-slate-400"><td className="border-r border-slate-400 px-2 py-1.5 text-center">{row.period}</td><td className="px-2 py-1.5">{row.content}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">使用デッキ歴</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead><tr className="border border-slate-400 bg-slate-50"><th className="w-28 border-r border-slate-400 px-2 py-1">時期</th><th className="px-2 py-1 text-left">デッキ名</th></tr></thead>
          <tbody>{deckRows.map((row, index) => <tr key={index} className="border border-slate-400"><td className="border-r border-slate-400 px-2 py-1.5 text-center">{row.period}</td><td className="px-2 py-1.5">{row.deckName}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">大会・デュエマ実績</h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{achievementLabels.length ? achievementLabels.map(label => <Chip key={label}>{label}</Chip>) : <span className="text-xs text-slate-400">（未選択）</span>}</div>
        {data.achievementNote && <p className="mt-1.5 text-xs">{data.achievementNote}</p>}
      </section>

      <section className="mt-3">
        <h2 className="border-b-2 border-slate-700 pb-1 text-base font-black">私にとってデュエマとは</h2>
        <div className="mt-1.5 min-h-[70px] whitespace-pre-wrap break-words border border-slate-400 p-2 text-xs leading-relaxed">{data.aboutDuema || '（未入力）'}</div>
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

export function ScaledResumePreview({ data, avatarUrl, photoImageUrl, className }: { data: ResumeData; avatarUrl: string | null; photoImageUrl: string | null; className?: string }) {
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
        <ResumePreview data={data} avatarUrl={avatarUrl} photoImageUrl={photoImageUrl} />
      </div>
    </div>
  )
}
