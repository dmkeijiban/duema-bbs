'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import { exactCardImageUrl } from '@/lib/card-catalog-shared'
import { RESUME_MAKER_SLUG, type ResumeData } from '@/lib/maker-resume'
import { formatResumeDate } from '@/lib/maker-resume-layout'
import { RESUME_VISUAL_LAYOUT as L } from '@/lib/maker-resume-visual-layout'
import { getResumeVisualContent } from '@/lib/maker-resume-render'
import { DefaultAvatarGlyph } from './ResumePreview'

function VisualChip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'muted' }) {
  return <span
    className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-sans font-bold"
    style={{
      height: 44, paddingInline: 18, fontSize: L.font.statLabel,
      borderColor: tone === 'muted' ? L.colors.lightLine : L.colors.accent,
      background: tone === 'muted' ? L.colors.chip : '#e8f3ee',
      color: tone === 'muted' ? L.colors.subInk : L.colors.accent,
    }}
  >{children}</span>
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0">
    <p className="font-sans font-bold" style={{ fontSize: L.font.statLabel, color: L.colors.subInk }}>{label}</p>
    <p className="mt-1 truncate font-black" style={{ fontSize: L.font.statValue, lineHeight: 1.1 }}>{value}</p>
  </div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-black" style={{ fontSize: L.font.sectionTitle, lineHeight: 1.1 }}>{children}</h2>
}

function DeckTile({ children }: { children: React.ReactNode }) {
  return <div
    className="flex min-w-0 max-w-full items-center justify-center overflow-hidden rounded-2xl border-2 px-5 py-3 text-center font-black"
    style={{ borderColor: L.colors.deckBorder, background: '#f3f9f6', color: L.colors.ink, fontSize: L.font.deckName, lineHeight: 1.25, maxHeight: 92 }}
  >{children}</div>
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return <div>
    <p className="font-sans font-bold" style={{ fontSize: L.font.label, color: L.colors.subInk }}>{label}</p>
    <div className="mt-1 whitespace-pre-wrap break-words font-sans" style={{ color: L.colors.ink }}>{children}</div>
  </div>
}

export function VisualResumePreview({ data, avatarUrl, resumeDate, exportRef }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; exportRef?: Ref<HTMLDivElement> }) {
  const content = getResumeVisualContent(data)
  const { profile } = content
  const supplementary = [profile.region, profile.duelMastersPlayStatus].filter(Boolean).join('　/　')
  const stats = [
    profile.ageGroup && { label: '年齢', value: profile.ageGroup },
    profile.favoriteCivilization && { label: '好きな文明', value: profile.favoriteCivilization },
    profile.playStyle && { label: 'プレイスタイル', value: profile.playStyle },
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  const hasDeckSection = content.deck.shown.length > 0 || Boolean(content.duelMastersPlayMainDeck)
  const hasInteraction = content.interaction.shown.length > 0 || Boolean(content.interaction.note.text)
  const hasAchievements = content.achievements.shown.length > 0 || Boolean(content.achievements.note.text)

  return <div ref={exportRef} data-resume-preview-root className="relative box-border flex shrink-0 flex-col overflow-hidden font-serif" style={{ width: L.width, height: L.height, padding: L.margin, background: L.colors.paper, color: L.colors.ink }}>
    <div className="pointer-events-none absolute border-[3px]" style={{ inset: L.outerBorderInset, borderColor: L.colors.line }} />

    <header className="flex items-start justify-between border-b-2 pb-6" style={{ borderColor: L.colors.line }}>
      <div className="min-w-0 flex-1 pr-6">
        <h1 className="truncate font-black" style={{ fontSize: L.font.name, lineHeight: 1.05 }}>{profile.name || '未入力'}</h1>

        {profile.generation && <div className="mt-3 flex items-baseline gap-3">
          <span className="shrink-0 font-sans font-bold" style={{ fontSize: L.font.generationLabel, color: L.colors.subInk }}>世代</span>
          <span className="truncate font-black" style={{ fontSize: L.font.generationValue, lineHeight: 1.1, color: L.colors.accent }}>{profile.generation}</span>
        </div>}

        {stats.length > 0 && <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">{stats.map(stat => <StatBlock key={stat.label} label={stat.label} value={stat.value} />)}</div>}

        {supplementary && <p className="mt-4 font-sans" style={{ fontSize: L.font.supplementary, color: L.colors.subInk }}>{supplementary}</p>}
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2" style={{ width: L.photoSize, height: L.photoSize, borderColor: L.colors.line, background: L.colors.label }}>
        {avatarUrl ? <img src={avatarUrl} alt="プロフィールアイコン" className="h-full w-full object-cover" /> : <DefaultAvatarGlyph color={L.colors.lightLine} />}
      </div>
    </header>

    {hasDeckSection && <section className="mt-8">
      <SectionTitle>使用デッキ</SectionTitle>
      {content.deck.shown.length > 0 && <div className="mt-3 flex flex-wrap gap-3">
        {content.deck.shown.map((name, index) => <DeckTile key={`${name}-${index}`}>{name}</DeckTile>)}
        {content.deck.extraCount > 0 && <div className="flex items-center rounded-2xl px-4 font-sans font-bold" style={{ color: L.colors.subInk, fontSize: L.font.deckExtra }}>ほか{content.deck.extraCount}件</div>}
      </div>}
      {content.duelMastersPlayMainDeck && <p className="mt-3 font-sans" style={{ fontSize: L.font.supplementary, color: L.colors.subInk }}>デュエプレの使用デッキ：{content.duelMastersPlayMainDeck}</p>}
    </section>}

    <div className="mt-8 flex min-h-0 flex-1 gap-8" style={{ marginBottom: 44 }}>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {content.favoriteYouTuber && <InfoBlock label="好きなYouTuber"><span style={{ fontSize: L.font.body }}>{content.favoriteYouTuber}</span></InfoBlock>}
        {content.otherInterests.text && <InfoBlock label="デュエマ以外で好きな事"><span style={{ fontSize: content.otherInterests.tier.fontSize, lineHeight: `${content.otherInterests.tier.lineHeight}px` }}>{content.otherInterests.text}</span></InfoBlock>}
        {hasInteraction && <InfoBlock label="対戦・交流について">
          {content.interaction.shown.length > 0 && <div className="flex flex-wrap gap-2">
            {content.interaction.shown.map(tag => <VisualChip key={tag}>{tag}</VisualChip>)}
            {content.interaction.extraCount > 0 && <VisualChip tone="muted">ほか{content.interaction.extraCount}件</VisualChip>}
          </div>}
          {content.interaction.note.text && <p className="mt-2" style={{ fontSize: content.interaction.note.tier.fontSize, lineHeight: `${content.interaction.note.tier.lineHeight}px` }}>{content.interaction.note.text}</p>}
        </InfoBlock>}
        {hasAchievements && <InfoBlock label="大会・デュエマ実績">
          {content.achievements.shown.length > 0 && <div className="flex flex-wrap gap-2">
            {content.achievements.shown.map(tag => <VisualChip key={tag}>{tag}</VisualChip>)}
            {content.achievements.extraCount > 0 && <VisualChip tone="muted">ほか{content.achievements.extraCount}件</VisualChip>}
          </div>}
          {content.achievements.note.text && <p className="mt-2" style={{ fontSize: content.achievements.note.tier.fontSize, lineHeight: `${content.achievements.note.tier.lineHeight}px` }}>{content.achievements.note.text}</p>}
        </InfoBlock>}
        {content.freeSpace.text && <InfoBlock label="フリースペース"><span style={{ fontSize: content.freeSpace.tier.fontSize, lineHeight: `${content.freeSpace.tier.lineHeight}px` }}>{content.freeSpace.text}</span></InfoBlock>}
      </div>

      {content.favoriteCard && <div className="flex w-[360px] shrink-0 flex-col items-center">
        <div className="flex w-full flex-1 items-start justify-center overflow-hidden rounded-xl">
          {content.favoriteCard.imageUrl
            ? <img src={exactCardImageUrl({ id: content.favoriteCard.cardId, imageUrl: content.favoriteCard.imageUrl }, RESUME_MAKER_SLUG)} alt={content.favoriteCard.name || '好きなカード'} className="h-full w-full object-contain" />
            : <div className="flex h-full w-full items-center justify-center rounded-xl border-2 font-sans text-slate-400" style={{ borderColor: L.colors.line, fontSize: L.font.label }}>画像なし</div>}
        </div>
        {content.favoriteCard.name && <p className="mt-3 truncate text-center font-black" style={{ width: '100%', fontSize: L.font.cardName }}>{content.favoriteCard.name}</p>}
        <p className="mt-1 font-sans font-bold" style={{ fontSize: L.font.label, color: L.colors.subInk }}>好きなカード</p>
        {content.favoriteCard.comment.text && <p className="mt-2 whitespace-pre-wrap break-words text-center font-sans" style={{ fontSize: content.favoriteCard.comment.tier.fontSize, lineHeight: `${content.favoriteCard.comment.tier.lineHeight}px`, color: L.colors.subInk }}>{content.favoriteCard.comment.text}</p>}
      </div>}
    </div>

    <p className="absolute left-0 text-center font-sans" style={{ top: L.height - L.margin / 2 - 26, width: L.width, color: L.colors.muted, fontSize: L.font.footer }}>デュエマ掲示板　https://www.duema-bbs.com　#デュエマ履歴書　作成日 {formatResumeDate(resumeDate)}</p>
  </div>
}

export function ScaledVisualResumePreview({ data, avatarUrl, resumeDate, className }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; className?: string }) {
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
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: L.width, height: L.height }}><VisualResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} /></div>
  </div>
}

export function FullscreenVisualResumePreview({ data, avatarUrl, resumeDate, className }: { data: ResumeData; avatarUrl: string | null; resumeDate?: string | null; className?: string }) {
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
        <VisualResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} />
      </div>
    </div>}
  </div>
}
