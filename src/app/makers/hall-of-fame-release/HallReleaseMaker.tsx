'use client'

import TierMaker, { type TierAggregate } from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup } from '@/lib/maker'
import { saveHallReleaseSubmission } from './actions'

export default function HallReleaseMaker(props: { cards: MakerCard[]; draft: MakerDraft; canSave: boolean; saved: boolean; aggregates: TierAggregate[] }) {
  const groups: MakerGroup[] = [{ key: 'release', label: '殿堂解除予想', color: 'border-orange-300 bg-orange-50 text-orange-900' }]
  return <TierMaker cards={props.cards} groups={groups} initialDraft={props.draft} unrated canSave={props.canSave} aggregates={props.aggregates} imageProxyPath="/api/makers/dm26-ex2-card-image"
    saveAction={saveHallReleaseSubmission} saveButtonLabel={props.canSave ? (props.saved ? '回答を更新' : '回答を登録') : 'ログインして回答を登録'} hasSavedSubmission={props.saved}
    storageSlug="hall-of-fame-release" exportTitle="殿堂解除選手権" exportFilename="hall-of-fame-release.png" shareText="殿堂解除選手権｜次に殿堂解除されるカードを予想しました！ #デュエマ掲示板"
    shareUrl="/makers/hall-of-fame-release?share=release-v1" communityTitle="みんなの殿堂解除予想" communityButtonLabel="📊 みんなの殿堂解除予想を見る"
    poolFilters={[{ value: 'hall', label: '殿堂' }, { value: 'premium', label: 'プレ殿' }]} aggregateMode="selection" exportBrand="デュエマ掲示板 参加企画" responseLabel="殿堂解除予想" />
}
