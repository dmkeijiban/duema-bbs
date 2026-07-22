export const RESUME_LAYOUT = {
  width: 1240, height: 1754, margin: 64, outerBorderInset: 32,
  headerRuleY: 156, infoTop: 184, photoSize: 190, photoGap: 40,
  rowHeight: 52, defaultLabelWidth: 110, compactLabelWidth: 90, fullLabelWidth: 150,
  sectionGap: 40, sectionTitleHeight: 40, sectionContentGap: 16,
  freeSpaceHeight: 180, chipHeight: 36, chipGap: 10, chipPaddingX: 14,
  colors: { paper: '#fdfdfb', ink: '#1f2933', subInk: '#52606d', line: '#334155', lightLine: '#94a3b8', label: '#f1f5f9', chip: '#eef2f6', muted: '#94a3b8' },
  font: { title: 56, date: 20, label: 18, value: 22, section: 30, body: 20, freeSpace: 22, chip: 18, footer: 16 },
} as const

export const RESUME_SECTION_ORDER = [
  'interaction',
  'achievements',
  'freeSpace',
] as const

export type ResumeSection = (typeof RESUME_SECTION_ORDER)[number]

export function formatResumeDate(value?: string | null) {
  const parsed = value ? new Date(value) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(date)
}
