import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { makerRequiresLogin } from '@/lib/maker-auth-requirements'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'
import { getAdstirVisibility } from '@/lib/adstir-server'
import DeckMakerClientShell from './DeckMakerClientShell'
import DeckKeyCardSelector from './DeckKeyCardSelector'
import DeckMakerNewDeckUx from './DeckMakerNewDeckUx'
import DeckMakerInitialDraftGuard from './DeckMakerInitialDraftGuard'
import DeckMakerMobileAdvanceLayoutFix from './DeckMakerMobileAdvanceLayoutFix'
import { createAdminClient } from '@/lib/supabase-admin'
import { getMakerAnonymousEditHash } from '@/lib/maker-anonymous-owner'
import type { DeckEntry, DeckFormat } from '@/lib/deck-maker'

const PAGE_URL = 'https://www.duema-bbs.com/makers/deck-maker'

export const metadata: Metadata = {
  title: 'デッキメーカー｜デュエマ掲示板',
  description: 'デュエル・マスターズのカードを検索して、40枚のデッキを作成できます。デッキ保存・画像出力にも対応。',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: 'デュエマ掲示板',
    locale: 'ja_JP',
    title: 'デッキメーカー｜デュエマ掲示板',
    description: 'カードを検索して、自分だけの40枚デッキを作成できます。',
  },
  robots: { index: true, follow: true },
}

export default async function DeckMakerPage({ searchParams }: { searchParams: Promise<{ copy?: string; edit?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (makerRequiresLogin() && !user) redirect('/login?next=/makers/deck-maker')
  const params = await searchParams
  const admin = createAdminClient()
  const anonymousHash = await getMakerAnonymousEditHash()
  let ownedQuery = admin.from('deck_submissions')
    .select('id,title,format,deck_data,key_card_id,key_card_printing_id,created_at,updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (user) ownedQuery = ownedQuery.eq('user_id', user.id)
  else if (anonymousHash) ownedQuery = ownedQuery.is('user_id', null).eq('anonymous_edit_token_hash', anonymousHash)
  else ownedQuery = ownedQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  const [{ data: ownedRows }, adstirVisibility] = await Promise.all([ownedQuery, getAdstirVisibility()])
  const dbDecks = (ownedRows ?? []).map(row => ({
    id: row.id,
    submissionId: row.id,
    name: row.title,
    entries: row.deck_data as DeckEntry[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    keyCardId: row.key_card_id,
    keyCardPrintingId: row.key_card_printing_id,
    format: row.format === 'advance' ? 'advance' as const : 'original' as const,
  }))
  const requestedId = params.edit ?? params.copy
  let initialDeck: { name: string; entries: DeckEntry[]; submissionId?: string; format?: DeckFormat; keyCardId?: string | null; keyCardPrintingId?: string | null } | undefined
  if (requestedId && /^[0-9a-f-]{36}$/i.test(requestedId)) {
    const { data } = await admin.from('deck_submissions').select('id,user_id,anonymous_edit_token_hash,title,format,deck_data,key_card_id,key_card_printing_id,is_public').eq('id', requestedId).maybeSingle()
    if (data?.is_public) {
      const editHash = params.edit ? await getMakerAnonymousEditHash() : null
      const canEdit = params.edit && ((user && data.user_id === user.id) || (!user && data.user_id === null && editHash && data.anonymous_edit_token_hash === editHash))
      if (!params.edit || canEdit) initialDeck = {
        name: params.copy ? `${data.title}のコピー` : data.title,
        entries: data.deck_data as DeckEntry[],
        format: data.format === 'advance' ? 'advance' : 'original',
        keyCardId: data.key_card_id,
        keyCardPrintingId: data.key_card_printing_id,
        ...(canEdit ? { submissionId: data.id } : {}),
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <style>{`
        @media (min-width: 1024px) {
          .deck-maker-width > div > .grid {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
          }
        }
      `}</style>
      <div className="deck-maker-width mx-auto max-w-7xl overflow-x-hidden">
        {adstirVisibility.listTop && <AdstirBannerClient slot="sp_list_top" className="mb-2 mt-0" />}
        <DeckMakerInitialDraftGuard enabled={Boolean(initialDeck)} />
        <DeckMakerNewDeckUx />
        <DeckMakerMobileAdvanceLayoutFix />
        <DeckMakerClientShell initialDeck={initialDeck} dbDecks={dbDecks} />
        <DeckKeyCardSelector initialCardId={initialDeck?.keyCardId} initialPrintingId={initialDeck?.keyCardPrintingId} />
      </div>
    </main>
  )
}
