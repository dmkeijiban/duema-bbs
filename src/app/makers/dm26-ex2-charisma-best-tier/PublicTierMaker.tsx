'use client'

import { useEffect, useRef, useState } from 'react'
import TierMaker, { type TierAggregate } from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import type { MakerCard, MakerDraft, MakerGroup, MakerSubmissionMeta } from '@/lib/maker'
import { getMakerAnonymousId } from '@/lib/maker-events-shared'
import { recordMakerPageView } from '@/lib/maker-events'
import { beginMakerSignup } from '@/lib/maker-signup-source'
import { anonymousSubmissionOwnerKey } from '@/lib/maker-anonymous-owner'

type Props = {
  cards: MakerCard[]
  groups: MakerGroup[]
  initialDraft: MakerDraft
  unrated: boolean
  canSave: boolean
  saveAction: (payload: Record<string, string[]>, meta?: MakerSubmissionMeta, anonymousId?: string | null) => Promise<{ ok: boolean; message: string; redirectTo?: string; submissionId?: string; ownerToken?: string }>
  saveButtonLabel: string
  hasSavedSubmission: boolean
  aggregates: TierAggregate[]
}

type ZoomedImage = { src: string; alt: string }

export default function PublicTierMaker(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pageViewIdRef = useRef<string | null>(null)
  const [zoomedImage, setZoomedImage] = useState<ZoomedImage | null>(null)

  useEffect(() => {
    // Strict Modeでeffectが再実行されても同じviewIdを送り、DB側の一意制約で1PVにする。
    pageViewIdRef.current ??= crypto.randomUUID()
    void recordMakerPageView({ slug: 'dm26-ex2-charisma-best-tier', viewId: pageViewIdRef.current, anonymousId: getMakerAnonymousId() }).catch(() => {})
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const tidyPublicUi = () => {
      root.querySelector('aside > h2')?.classList.add('hidden')

      for (const row of root.querySelectorAll<HTMLElement>('aside > div')) {
        if (row.querySelector('select')) row.classList.add('hidden')
      }

      for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
        if (button.textContent?.trim() === '📷 画像保存') button.textContent = '画像保存'
      }
    }

    tidyPublicUi()
    const observer = new MutationObserver(tidyPublicUi)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!zoomedImage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomedImage(null)
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [zoomedImage])

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return

    const dialog = target.closest<HTMLElement>('[role="dialog"]')
    if (!dialog || dialog.getAttribute('aria-labelledby') !== 'tier-card-title') return

    setZoomedImage({ src: target.src, alt: target.alt })
  }

  async function saveWithAnonymousOwner(payload: Record<string, string[]>, meta?: MakerSubmissionMeta) {
    const result = await props.saveAction(payload, meta, getMakerAnonymousId())
    if (result.ok && result.submissionId && result.ownerToken) {
      localStorage.setItem(anonymousSubmissionOwnerKey('dm26-ex2-charisma-best-tier', result.submissionId), result.ownerToken)
    }
    return result
  }

  return (
    <div ref={rootRef} onClickCapture={handleClickCapture}>
      <TierMaker
        cards={props.cards}
        groups={props.groups}
        initialDraft={props.initialDraft}
        unrated={props.unrated}
        canSave={props.canSave}
        saveAction={saveWithAnonymousOwner}
        submissionFields={{ defaultTitle: 'カリスマBEST Tier表' }}
        saveButtonLabel={props.saveButtonLabel}
        hasSavedSubmission={props.hasSavedSubmission}
        aggregates={props.aggregates}
        imageProxyPath="/api/makers/dm26-ex2-card-image"
        eventSlug="dm26-ex2-charisma-best-tier"
        communityHref="/makers/dm26-ex2-charisma-best-tier/submissions"
        registrationLabel="Tier表"
        beforeLogin={async () => {
          const anonymousId = getMakerAnonymousId()
          if (anonymousId) await beginMakerSignup(anonymousId)
        }}
      />

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setZoomedImage(null)
          }}
        >
          <button
            type="button"
            aria-label="拡大画像を閉じる"
            onClick={() => setZoomedImage(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-3xl leading-none text-black"
          >
            ×
          </button>
          <img
            src={zoomedImage.src}
            alt={zoomedImage.alt}
            className="max-h-[92vh] max-w-[94vw] object-contain"
          />
        </div>
      )}
    </div>
  )
}
