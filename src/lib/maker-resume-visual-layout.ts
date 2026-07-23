/**
 * 見やすさ重視レイアウト（layoutType: 'visual'）の寸法・配色・フォント定義。
 * 標準レイアウト（maker-resume-layout.ts の RESUME_LAYOUT）とは別定義とし、標準側の見た目には影響しない。
 * 書き出し（Canvas/PNG）は DOM スナップショットのため、キャンバスサイズは標準と同じ 1240x1754 に揃える。
 */
export const RESUME_VISUAL_LAYOUT = {
  width: 1240,
  height: 1754,
  margin: 72,
  outerBorderInset: 32,
  photoSize: 300,
  colors: {
    paper: '#fdfdfb',
    ink: '#1a2230',
    subInk: '#52606d',
    line: '#000000',
    lightLine: '#94a3b8',
    label: '#f1f5f9',
    chip: '#eef2f6',
    muted: '#94a3b8',
    accent: '#0f4d3c',
    deckBorder: '#0f4d3c',
  },
  font: {
    name: 108,
    generationLabel: 22,
    generationValue: 60,
    statLabel: 18,
    statValue: 32,
    supplementary: 22,
    sectionTitle: 34,
    deckName: 34,
    deckExtra: 22,
    body: 28,
    label: 19,
    cardName: 30,
    footer: 18,
    date: 20,
  },
} as const

export type ResumeVisualLayout = typeof RESUME_VISUAL_LAYOUT
