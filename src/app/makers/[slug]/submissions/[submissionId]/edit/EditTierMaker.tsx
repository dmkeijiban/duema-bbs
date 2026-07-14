'use client'

import TierMaker from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup, MakerSubmissionMeta } from '@/lib/maker'
import { useAnonymousSubmissionOwnerToken } from '@/lib/use-anonymous-submission-owner'

export default function EditTierMaker({ cards, groups, draft, title, comment, saveAction, slug, submissionId, anonymousOwner }: { cards: MakerCard[]; groups: MakerGroup[]; draft: MakerDraft; title: string; comment: string; slug: string; submissionId: string; anonymousOwner: boolean; saveAction: (payload: Record<string, string[]>, meta?: MakerSubmissionMeta, anonymousToken?: string | null) => Promise<{ ok: boolean; message: string; redirectTo?: string }> }) {
  const token = useAnonymousSubmissionOwnerToken(slug, submissionId, anonymousOwner)
  if (token === null) return <p className="mt-5 rounded border bg-white p-5 text-sm text-gray-600">このTier表を編集する権限がありません。</p>
  const wrappedSave = (payload: Record<string, string[]>, meta?: MakerSubmissionMeta) => saveAction(payload, meta, token)
  return <TierMaker cards={cards} groups={groups} initialDraft={draft} unrated canSave aggregates={[]} saveAction={wrappedSave} submissionFields={{ defaultTitle: title, defaultComment: comment }} saveButtonLabel="変更を保存" communityHref={`/makers/${slug}/submissions`} registrationHeading="Tier表を編集" storageSlug={`${slug}:edit:${submissionId}`} />
}
