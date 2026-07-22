import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_SOCIAL_TAG_PRESETS,
  type ResumeData,
} from '@/lib/maker-resume'

/**
 * 履歴書上では、空白と既存データに残った単独ハイフンを未入力として扱う。
 * 保存値は変更せず、DOMプレビューとPNGの表示判断だけを共通化する。
 */
export function resumeDisplayText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text === '-' ? '' : text
}

function presetLabels(keys: unknown, presets: readonly { key: string; label: string }[]): string[] {
  if (!Array.isArray(keys)) return []
  const labels = new Map(presets.map(preset => [preset.key, preset.label]))
  return keys.flatMap(key => {
    if (typeof key !== 'string') return []
    const label = labels.get(key)
    return label ? [label] : []
  })
}

export function getResumeSectionContent(data: ResumeData) {
  return {
    interaction: {
      tags: presetLabels(data.socialTags, RESUME_SOCIAL_TAG_PRESETS),
      note: resumeDisplayText(data.socialNote),
    },
    achievements: {
      tags: presetLabels(data.achievements, RESUME_ACHIEVEMENT_PRESETS),
      note: resumeDisplayText(data.achievementNote),
    },
    freeSpace: {
      text: resumeDisplayText(data.freeSpace),
    },
  }
}
