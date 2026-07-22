'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import { exactCardImageUrl } from '@/lib/card-catalog-shared'
import { RESUME_MAKER_SLUG, type ResumeData } from '@/lib/maker-resume'
import { formatResumeDate, RESUME_DEFAULT_AVATAR_PATH, RESUME_LAYOUT as L, RESUME_SECTION_ORDER, type ResumeSection } from '@/lib/maker-resume-layout'
import { getResumeSectionContent } from '@/lib/maker-resume-render'

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-sans font-bold" style={{ height: L.chipHeight, paddingInline: L.chipPaddingX, borderColor: L.colors.lightLine, background: L.colors.chip, fontSize: L.font.chip }}>{children}</span>
}

function DefaultAvatarGlyph() {
  return <svg className="h-1/2 w-1/2" style={{ color: L.colors.lightLine }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={RESUME_DEFAULT_AVATAR_PATH} /></svg>
}

type FieldCell = [label: string, value: string]

function estimateWrappedLines(value: string, charactersPerLine: number) {
  if (!value.trim()) return 1
  return value.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / charactersPerLine)), 0)
}

function getRowLines(cells: FieldCell[], charactersPerLine: number, maxLines = 3) {
  return Math.min(maxLines, Math.max(1, ...cells.map(([, value]) => estimateWrappedLines(value, charactersPerLine))))
}

function FieldRow({ cells, labelWidth = L.defaultLabelWidth, columnFractions, charactersPerLine, maxLines = 3 }: { cells: FieldCell[]; labelWidth?: number; columnFractions?: number[]; charactersPerLine?: number; maxLines?: number }) {
  const columns = columnFractions?.length === cells.length ? columnFractions.map(value => `${value}fr`).join(' ') : `repeat(${cells.length}, 1fr)`
  const rowLines = getRowLines(cells, charactersPerLine ?? (cells.length === 1 ? 42 : 16), maxLines)
  const rowHeight = L.rowHeight * rowLines
  const shouldWrap = rowLines > 1
  return <div className="grid -mt-0.5 border-2 first:mt-0" style={{ minHeight: rowHeight, gridTemplateColumns: columns, borderColor: L.colors.line }}>
    {cells.map(([label, value]) => <div key={label} className="flex min-w-0 border-r-2 last:border-r-0" style={{ minHeight: rowHeight, borderColor: L.colors.line }}>
      <div className="flex shrink-0 items-center justify-center whitespace-nowrap border-r-2 px-2 text-center font-sans font-bold" style={{ width: labelWidth, borderColor: L.colors.line, background: L.colors.label, color: L.colors.subInk, fontSize: L.font.label }}>{label}</div>
      <div className={`flex min-w-0 flex-1 items-center justify-center overflow-hidden px-2 text-center font-sans ${shouldWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'}`} style={{ color: L.colors.ink, fontSize: L.font.value, lineHeight: shouldWrap ? '28px' : undefined }}>{value}</div>
    </div>)}
  </div>
}

function PairedExpandableFieldRow({ cells }: { cells: [FieldCell, FieldCell] }) {
  const lines = getRowLines(cells, 13, 3)
  const height = L.rowHeight * lines
  const shouldWrap = lines > 1
  return <div className="grid -mt-0.5 grid-cols-2 border-2 first:mt-0" style={{ minHeight: height, borderColor: L.colors.line }}>
    {cells.map(([label, value]) => <div key={label} className="grid min-w-0 border-r-2 last:border-r-0" style={{ minHeight: height, gridTemplateColumns: `${L.fullLabelWidth}px minmax(0, 1fr)`, borderColor: L.colors.line }}>
      <div className="flex items-center justify-center whitespace-nowrap border-r-2 px-2 text-center font-sans font-bold" style={{ borderColor: L.colors.line, background: L.colors.label, color: L.colors.subInk, fontSize: L.font.label }}>{label}</div>
      <div className={`flex min-w-0 items-center justify-center overflow-hidden px-2 text-center font-sans ${shouldWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'}`} style={{ color: L.colors.ink, fontSize: L.font.value, lineHeight: shouldWrap ? '28px' : undefined }}>{value}</div>
    </div>)}
  </div>
}

function getFreeSpaceHeight(value: string) {
  const contentHeight = estimateWrappedLines(value, 34) * 28 + 32
  return Math.min(360, Math.max(L.freeSpaceHeight, contentHeight))
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="shrink-0 font-black" style={{ height: L.sectionTitleHeight, fontSize: L.font.section, lineHeight: 1 }}>{children}</h2>
}

function SectionHeading({ title, tags }: { title: string; tags: string[] }) {
  return <div className="flex min-h-8 items-start gap-4">
    <SectionTitle>{title}</SectionTitle>
    <div className="flex min-w-0 flex-1 flex-wrap font-sans" style={{ marginTop: -3, gap: L.chipGap }}>{tags.map(label => <Chip key={label}>{label}</Chip>)}</div>
  </div>
}

export function ResumePreview({ data, avatarUrl, resumeDate, exportRef }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; exportRef?: Ref<HTMLDivElement> }) {
  const sectionContent = getResumeSectionContent(data)
  const favoriteCard = data.photo?.type === 'card' ? data.photo : null
  const freeSpaceHeight = getFreeSpaceHeight(sectionContent.freeSpace.text)
  const renderSection = (section: ResumeSection) => {
    switch (section) {
      case 'interaction':
        return <section key={section} style={{ marginTop: L.sectionGap }}><SectionHeading title="対戦・交流について" tags={sectionContent.interaction.tags} />
          {sectionContent.interaction.note && <div className="box-border flex h-[52px] items-center border-2 px-3 font-sans" style={{ marginTop: L.sectionContentGap, borderColor: L.colors.line, fontSize: L.font.body, lineHeight: '20px' }}>{sectionContent.interaction.note}</div>}
        </section>
      case 'achievements':
        return <section key={section} style={{ marginTop: L.sectionGap }}><SectionHeading title="大会・デュエマ実績" tags={sectionContent.achievements.tags} />
          {sectionContent.achievements.note && <div className="box-border flex h-[52px] items-center border-2 px-3 font-sans" style={{ marginTop: L.sectionContentGap, borderColor: L.colors.line, fontSize: L.font.body, lineHeight: '20px' }}>{sectionContent.achievements.note}</div>}
        </section>
      case 'freeSpace':
        return <section key={section} style={{ marginTop: 30 }}>
          <div className="flex items-end justify-between" style={{ gap: L.outerBorderInset }}>
            <SectionTitle>フリースペース</SectionTitle>
            {favoriteCard && <h2 className="font-black text-center" style={{ width: 360, height: L.sectionTitleHeight, fontSize: L.font.section, lineHeight: 1 }}>好きなカード</h2>}
          </div>
          <div className="flex items-start" style={{ marginTop: L.sectionContentGap, gap: L.outerBorderInset }}>
            <div className="min-w-0 flex-1 overflow-hidden whitespace-pre-wrap break-words border-2 p-4 font-sans" style={{ height: freeSpaceHeight, borderColor: L.colors.line, fontSize: L.font.freeSpace, lineHeight: '28px' }}>{sectionContent.freeSpace.text}</div>
            {favoriteCard && <div className="flex h-[504px] w-[360px] shrink-0 items-start justify-center overflow-visible">
              {favoriteCard.imageUrl ? <img src={exactCardImageUrl({ id: favoriteCard.cardId, imageUrl: favoriteCard.imageUrl }, RESUME_MAKER_SLUG)} alt={favoriteCard.name || '好きなカード'} className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center border-2 font-sans text-slate-400" style={{ borderColor: L.colors.line, fontSize: L.font.body }}>画像なし</div>}
            </div>}
          </div>
        </section>
    }
  }
  return <div ref={exportRef} data-resume-preview-root className="relative box-border shrink-0 font-serif" style={{ width: L.width, height: L.height, padding: L.margin, background: L.colors.paper, color: L.colors.ink }}>
    <div className="pointer-events-none absolute border-[3px]" style={{ inset: L.outerBorderInset, borderColor: L.colors.line }} />
    <header className="flex items-start justify-between border-b-2" style={{ height: L.headerRuleY - L.margin, borderColor: L.colors.line }}>
      <h1 className="font-black" style={{ fontSize: L.font.title, lineHeight: 1 }}>デュエマ履歴書</h1>
      <p className="mt-[70px] font-sans" style={{ color: L.colors.subInk, fontSize: L.font.date, lineHeight: 1 }}>作成日 {formatResumeDate(resumeDate)}</p>
    </header>
    <div className="flex" style={{ marginTop: L.infoTop - L.headerRuleY, gap: L.photoGap }}>
      <div className="flex-1">
        <FieldRow cells={[["名前", data.handleName || '未入力']]} />
        <FieldRow cells={[["開始時期", data.startedAt || '-'], ['世代', data.generation || '-']]} />
        <FieldRow cells={[["性別", data.gender || '-'], ['年齢', data.ageGroup || '-']]} />
        <FieldRow cells={[["好きな文明", data.favoriteCivilization || '-'], ['プレイスタイル', data.playStyle || '-']]} />
        <FieldRow cells={[["活動地域", data.region || '-'], ['デュエプレ', data.duelMastersPlayStatus || '-']]} />
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden border-2" style={{ width: L.photoSize, height: L.photoSize, borderColor: L.colors.line, background: L.colors.label }}>
        {avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <DefaultAvatarGlyph />}
      </div>
    </div>
    <section style={{ marginTop: L.sectionGap }}>
      <FieldRow labelWidth={L.fullLabelWidth} charactersPerLine={38} maxLines={3} cells={[["使用デッキ", data.currentDecksText || '-']]} />
      <FieldRow labelWidth={L.fullLabelWidth} charactersPerLine={38} maxLines={3} cells={[["デュエプレの使用デッキ", data.duelMastersPlayMainDeck || '-']]} />
      <PairedExpandableFieldRow cells={[["好きなYouTuber", data.favoriteYouTuber || '-'], ['好きな事', data.otherInterests || '-']]} />
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

export function FullscreenResumePreview({ data, avatarUrl, resumeDate, className }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setScale(Math.min(1, element.clientWidth / L.width, element.clientHeight / L.height))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={containerRef} className={`flex h-full min-h-0 w-full items-center justify-center overflow-hidden ${className ?? ''}`}>
    {scale > 0 && <div className="shrink-0" style={{ width: L.width * scale, height: L.height * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: L.width, height: L.height }}>
        <ResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} />
      </div>
    </div>}
  </div>
}
