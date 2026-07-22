'use client'

import { useEffect, useRef, useState } from 'react'
import type { ResumeData } from '@/lib/maker-resume'
import { formatResumeDate, RESUME_DEFAULT_AVATAR_PATH, RESUME_LAYOUT as L, RESUME_SECTION_ORDER, type ResumeSection } from '@/lib/maker-resume-layout'
import { getResumeSectionContent } from '@/lib/maker-resume-render'

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-sans font-bold" style={{ height: L.chipHeight, paddingInline: L.chipPaddingX, borderColor: L.colors.lightLine, background: L.colors.chip, fontSize: L.font.chip }}>{children}</span>
}

function DefaultAvatarGlyph() {
  return <svg className="h-1/2 w-1/2" style={{ color: L.colors.lightLine }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={RESUME_DEFAULT_AVATAR_PATH} /></svg>
}

type FieldCell = [label: string, value: string]

function FieldRow({ cells, labelWidth = L.defaultLabelWidth, columnFractions }: { cells: FieldCell[]; labelWidth?: number; columnFractions?: number[] }) {
  const columns = columnFractions?.length === cells.length ? columnFractions.map(value => `${value}fr`).join(' ') : `repeat(${cells.length}, 1fr)`
  return <div className="grid border" style={{ height: L.rowHeight, gridTemplateColumns: columns, borderColor: L.colors.line }}>
    {cells.map(([label, value]) => <div key={label} className="flex min-w-0 border-r last:border-r-0" style={{ borderColor: L.colors.line }}>
      <div className="flex shrink-0 items-center justify-center whitespace-nowrap border-r px-2 text-center font-sans font-bold" style={{ width: labelWidth, borderColor: L.colors.lightLine, background: L.colors.label, color: L.colors.subInk, fontSize: L.font.label }}>{label}</div>
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden whitespace-nowrap px-2 text-center font-sans" style={{ color: L.colors.ink, fontSize: L.font.value }}>{value}</div>
    </div>)}
  </div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-black" style={{ height: L.sectionTitleHeight, fontSize: L.font.section, lineHeight: 1 }}>{children}</h2>
}

export function ResumePreview({ data, avatarUrl, resumeDate }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null }) {
  const sectionContent = getResumeSectionContent(data)
  const renderSection = (section: ResumeSection) => {
    switch (section) {
      case 'interaction':
        return <section key={section} style={{ marginTop: L.sectionGap }}><SectionTitle>対戦・交流について</SectionTitle>
          <div className="flex flex-wrap font-sans" style={{ marginTop: L.sectionContentGap, gap: L.chipGap }}>{sectionContent.interaction.tags.map(label => <Chip key={label}>{label}</Chip>)}</div>
          {sectionContent.interaction.note && <p className="box-border h-10 pt-[10px] font-sans" style={{ fontSize: L.font.body, lineHeight: '20px' }}>{sectionContent.interaction.note}</p>}
        </section>
      case 'achievements':
        return <section key={section} style={{ marginTop: L.sectionGap }}><SectionTitle>大会・デュエマ実績</SectionTitle>
          <div className="flex flex-wrap font-sans" style={{ marginTop: L.sectionContentGap, gap: L.chipGap }}>{sectionContent.achievements.tags.map(label => <Chip key={label}>{label}</Chip>)}</div>
          {sectionContent.achievements.note && <p className="box-border h-10 pt-[10px] font-sans" style={{ fontSize: L.font.body, lineHeight: '20px' }}>{sectionContent.achievements.note}</p>}
        </section>
      case 'freeSpace':
        return <section key={section} style={{ marginTop: 30 }}><SectionTitle>フリースペース</SectionTitle>
          <div className="overflow-hidden whitespace-pre-wrap break-words border p-4 font-sans" style={{ marginTop: L.sectionContentGap, height: L.freeSpaceHeight, borderColor: '#cbd5e1', fontSize: L.font.freeSpace, lineHeight: '28px' }}>{sectionContent.freeSpace.text}</div>
        </section>
    }
  }
  return <div className="relative box-border shrink-0 font-serif" style={{ width: L.width, height: L.height, padding: L.margin, background: L.colors.paper, color: L.colors.ink }}>
    <div className="pointer-events-none absolute border-[3px]" style={{ inset: L.outerBorderInset, borderColor: L.colors.line }} />
    <header className="flex items-start justify-between border-b-2" style={{ height: L.headerRuleY - L.margin, borderColor: L.colors.line }}>
      <h1 className="font-black" style={{ fontSize: L.font.title, lineHeight: 1 }}>デュエマ履歴書</h1>
      <p className="mt-[70px] font-sans" style={{ color: L.colors.subInk, fontSize: L.font.date, lineHeight: 1 }}>作成日 {formatResumeDate(resumeDate)}</p>
    </header>
    <div className="flex" style={{ marginTop: L.infoTop - L.headerRuleY, gap: L.photoGap }}>
      <div className="flex-1">
        <FieldRow cells={[["名前", data.handleName || '未入力']]} />
        <FieldRow cells={[["開始時期", data.startedAt || '-'], ['活動地域', data.region || '-']]} />
        <FieldRow labelWidth={L.compactLabelWidth} cells={[["性別", data.gender || '-'], ['年齢', data.ageGroup || '-']]} />
        <FieldRow labelWidth={L.profileChoiceLabelWidth} cells={[["好きな文明", data.favoriteCivilization || '-'], ['プレイスタイル', data.playStyle || '-']]} />
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden border-2" style={{ width: L.photoSize, height: L.photoSize, borderColor: L.colors.line, background: L.colors.label }}>
        {avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <DefaultAvatarGlyph />}
      </div>
    </div>
    <section style={{ marginTop: L.sectionGap }}>
      <FieldRow labelWidth={L.fullLabelWidth} columnFractions={[2, 1]} cells={[["使用デッキ", data.currentDecksText || '-'], ['デュエプレ', data.playsDuelMastersPlay || '-']]} />
      <FieldRow labelWidth={L.fullLabelWidth} cells={[["好きなYouTuber", data.favoriteYouTuber || '-'], ['好きな事', data.otherInterests || '-']]} />
    </section>
    {RESUME_SECTION_ORDER.map(renderSection)}
    <p className="absolute left-0 text-center font-sans" style={{ top: L.height - L.margin / 2 - 28, width: L.width, color: L.colors.muted, fontSize: L.font.footer }}>デュエマ掲示板　https://www.duema-bbs.com　#デュエマ履歴書</p>
  </div>
}

export function ScaledResumePreview({ data, avatarUrl, resumeDate, className }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setScale(Math.min(1, element.clientWidth / L.width))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={containerRef} className={className} style={{ height: L.height * scale }}>
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: L.width, height: L.height }}><ResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} /></div>
  </div>
}
