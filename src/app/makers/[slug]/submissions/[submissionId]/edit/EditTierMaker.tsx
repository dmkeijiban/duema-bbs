'use client'

import TierMaker from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup, MakerSubmissionMeta } from '@/lib/maker'

export default function EditTierMaker({ cards, groups, draft, title, comment, saveAction, slug, submissionId }: { cards: MakerCard[]; groups: MakerGroup[]; draft: MakerDraft; title: string; comment: string; slug: string; submissionId: string; saveAction: (payload: Record<string, string[]>, meta?: MakerSubmissionMeta) => Promise<{ ok: boolean; message: string; redirectTo?: string }> }) {
  return <TierMaker cards={cards} groups={groups} initialDraft={draft} unrated canSave aggregates={[]} saveAction={saveAction} submissionFields={{ defaultTitle: title, defaultComment: comment }} saveButtonLabel="変更を保存" communityHref={`/makers/${slug}/submissions`} registrationHeading="Tier表を編集" storageSlug={`${slug}:edit:${submissionId}`} />
}
