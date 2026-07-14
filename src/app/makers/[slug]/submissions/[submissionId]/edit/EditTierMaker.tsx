'use client'

import TierMaker from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup, MakerSubmissionMeta } from '@/lib/maker'

const RELEASE_ROW_LABELS = { release: '殿堂解除\n予想' }

export default function EditTierMaker({
  cards,
  groups,
  draft,
  title,
  comment,
  saveAction,
  slug,
  submissionId,
  prediction = false,
}: {
  cards: MakerCard[]
  groups: MakerGroup[]
  draft: MakerDraft
  title: string
  comment: string
  slug: string
  submissionId: string
  prediction?: boolean
  saveAction: (payload: Record<string, string[]>, meta?: MakerSubmissionMeta) => Promise<{ ok: boolean; message: string; redirectTo?: string }>
}) {
  return <TierMaker
    cards={cards}
    groups={groups}
    initialDraft={draft}
    unrated
    canSave
    aggregates={[]}
    saveAction={saveAction}
    submissionFields={{ defaultTitle: title, defaultComment: comment }}
    saveButtonLabel="変更を保存"
    communityHref={`/makers/${slug}/submissions`}
    registrationHeading={prediction ? '殿堂解除予想を編集' : 'Tier表を編集'}
    storageSlug={`${slug}:edit:${submissionId}`}
    {...(prediction ? {
      imageProxyPath: '/api/makers/dm26-ex2-card-image',
      exportTitle: '2026年7月27日 殿堂解除選手権',
      exportFilename: 'hall-of-fame-release.png',
      poolFilters: [{ value: 'hall', label: '殿堂' }, { value: 'premium', label: 'プレ殿' }],
      aggregateMode: 'selection' as const,
      responseLabel: '殿堂解除予想',
      groupRowClassName: 'overflow-hidden border-amber-300 bg-white text-slate-900',
      groupGridClassName: 'grid-cols-[64px_1fr]',
      groupLabelClassName: 'bg-amber-400 px-1 text-center text-[13px] leading-tight text-amber-950',
      groupLabelText: RELEASE_ROW_LABELS,
      cardBadgePositionClassName: 'bottom-1 right-1',
      cardBadgeTextClassName: '',
      selectionImageZoom: true,
    } : {})}
  />
}
