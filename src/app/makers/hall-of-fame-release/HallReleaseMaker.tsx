'use client'

import { useEffect, useRef } from 'react'
import TierMaker, { type TierAggregate } from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup } from '@/lib/maker'
import { recordMakerPageView } from '@/lib/maker-events'
import { getMakerAnonymousId } from '@/lib/maker-events-shared'
import { HALL_RELEASE_DESIGN } from '@/lib/hall-release-design'
import { saveHallReleaseSubmission } from './actions'

export default function HallReleaseMaker(props: { cards: MakerCard[]; draft: MakerDraft; canSave: boolean; saved: boolean; aggregates: TierAggregate[] }) {
  const pageViewIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pageViewIdRef.current) pageViewIdRef.current = crypto.randomUUID()
    void recordMakerPageView({ slug: 'hall-of-fame-release', viewId: pageViewIdRef.current, anonymousId: getMakerAnonymousId() }).catch(() => {})
  }, [])
  const groups: MakerGroup[] = [{ key: 'release', label: '殿堂解除予想', color: 'border-amber-400 bg-amber-100 text-amber-950' }]
  return <div className="hall-release-maker">
    <TierMaker cards={props.cards} groups={groups} initialDraft={props.draft} unrated canSave={props.canSave} aggregates={props.aggregates} imageProxyPath="/api/makers/dm26-ex2-card-image"
      eventSlug="hall-of-fame-release"
      saveAction={saveHallReleaseSubmission} submissionFields={{ defaultTitle: '殿堂解除予想' }} registrationHeading="" saveButtonLabel="予想を登録" hasSavedSubmission={props.saved}
      storageSlug="hall-of-fame-release" exportTitle="2026年7月27日 殿堂解除選手権" exportFilename="hall-of-fame-release.png" shareText="殿堂解除選手権｜みんなで予想しよう！"
      shareUrl="/makers/hall-of-fame-release?share=release-v1" communityTitle="みんなの殿堂解除予想" communityButtonLabel="📊 みんなの殿堂解除予想を見る" communityHref="/makers/hall-of-fame-release/submissions"
      poolFilters={[{ value: 'hall', label: '殿堂' }, { value: 'premium', label: 'プレ殿' }]} aggregateMode="selection" responseLabel="殿堂解除予想"
      groupRowClassName={HALL_RELEASE_DESIGN.rowClassName} groupGridClassName={HALL_RELEASE_DESIGN.labelWidth.standardClass} groupLabelClassName={HALL_RELEASE_DESIGN.labelClassName} hallReleaseLabel
      cardBadgePositionClassName="bottom-1 right-1" cardBadgeTextClassName="" selectionImageZoom autoRegisterOnImageSave />
    <style jsx global>{`
      .hall-release-maker > div > section {
        display: flex;
        flex-direction: column;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) {
        order: -1;
        margin-top: 0 !important;
        margin-bottom: 0.75rem;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) > h2 {
        display: none;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) > label {
        display: block;
        margin-top: 0;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) > label + label {
        margin-top: 0.75rem;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) input,
      .hall-release-maker > div > section > div:nth-of-type(2) textarea {
        margin-top: 0.375rem;
        min-width: 0;
        min-height: 2.75rem;
        box-sizing: border-box;
      }
      .hall-release-maker > div > section > div:nth-of-type(2) textarea {
        height: 2.75rem;
        resize: none;
      }
      .hall-release-maker > div > section > div:nth-of-type(3) > button:first-child {
        font-size: 0;
      }
      .hall-release-maker > div > section > div:nth-of-type(3) > button:first-child::after {
        content: '新しく作る';
        font-size: 0.875rem;
      }
      @media (min-width: 1024px) {
        .hall-release-maker > div {
          position: relative;
        }
        .hall-release-maker > div > section > div:nth-of-type(3) {
          position: absolute;
          top: 0;
          right: 0;
          z-index: 1;
          width: 360px;
          justify-content: flex-end;
        }
        .hall-release-maker > div > section > div:nth-of-type(3) > button {
          flex: none;
        }
        .hall-release-maker > div > aside {
          margin-top: 8.25rem;
        }
      }
      @media (max-width: 639px) {
        .hall-release-maker > div > section > div:nth-of-type(2) {
          padding: 1rem;
        }
        .hall-release-maker > div > section > div:nth-of-type(2) > label {
          display: block;
          width: 100%;
        }
        .hall-release-maker > div > section > div:nth-of-type(2) input,
        .hall-release-maker > div > section > div:nth-of-type(2) textarea {
          display: block;
          width: 100%;
          margin-top: 0.375rem;
        }
        .hall-release-maker > div > section > div:nth-of-type(2) textarea {
          height: 4.5rem;
        }
      }
    `}</style>
  </div>
}
