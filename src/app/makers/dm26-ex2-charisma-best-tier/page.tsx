import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { emptyMakerDraft, parseMakerProjectConfig, type MakerCard, type MakerDraft } from '@/lib/maker'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import PublicTierMaker from './PublicTierMaker'
import { savePublicTierSubmission } from './actions'
import officialCardsJson from '../../../../scripts/fixtures/dm26-ex2-standard-89.import-candidates.json'

export const dynamic = 'force-dynamic'

const PAGE_URL = 'https://www.duema-bbs.com/makers/dm26-ex2-charisma-best-tier'
const OG_IMAGE_URL = 'https://www.duema-bbs.com/og/makers/dm26-ex2-charisma-best-tier-v2.png?v=3'

export const metadata: Metadata = {
  title: 'カリスマBEST Tier表メーカー｜デュエマ掲示板',
  description: 'DM26-EX2「悪感謝祭 カリスマBEST」のカードを自由に並べて、自分だけのTier表を作成できます。画像保存・X共有・みんなのTier集計にも対応。',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: 'デュエマ掲示板',
    locale: 'ja_JP',
    title: 'カリスマBEST Tier表メーカー',
    description: 'DM26-EX2「悪感謝祭 カリスマBEST」のカードを並べて、自分だけのTier表を作ろう。画像保存・X共有・みんなのTier集計にも対応。',
    images: [{
      url: OG_IMAGE_URL,
      width: 1200,
      height: 630,
      alt: 'DM26-EX2 悪感謝祭 カリスマBEST Tier表メーカー',
      type: 'image/png',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'カリスマBEST Tier表メーカー',
    description: '新弾カードを自由に並べて、自分だけのTier表を作成できます。画像保存・X共有にも対応。',
    images: [{ url: OG_IMAGE_URL, alt: 'DM26-EX2 悪感謝祭 カリスマBEST Tier表メーカー' }],
  },
  robots: { index: true, follow: true },
}

type ProjectRow = { id: string; config: unknown }
type LinkRow = { cards: { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null } }
type OfficialCard = { card_number: string; card_name: string }
const metadataByName = new Map((officialCardsJson as OfficialCard[]).map(card => [card.card_name, card]))

export default async function PublicTierMakerPage() {
  const admin = createAdminClient()
  const { data: projectData, error: projectError } = await admin
    .from('maker_projects')
    .select('id,config')
    .eq('slug', 'dm26-ex2-charisma-best-tier')
    .eq('is_public', true)
    .eq('status', 'published')
    .maybeSingle()

  if (projectError || !projectData) notFound()
  const project = projectData as ProjectRow
  const config = parseMakerProjectConfig(project.config)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: links, error: linksError } = await admin
    .from('maker_project_cards').select('sort_order,cards!inner(id,name,image_url,civilization,cost,card_type,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order')
  if (linksError || !links?.length) notFound()

  const cards: MakerCard[] = (links as unknown as LinkRow[]).map(link => {
    const metadata = metadataByName.get(link.cards.name)
    return {
      id: link.cards.id,
      name: link.cards.name,
      cardNumber: metadata?.card_number,
      rarity: metadata?.card_number.startsWith('SPR') ? 'SPR' : null,
      searchText: `${link.cards.name} ${metadata?.card_number ?? ''}`,
      imageUrl: link.cards.image_url,
      civilization: link.cards.civilization ?? [],
      cost: link.cards.cost,
      cardType: link.cards.card_type,
    }
  })
  const draft: MakerDraft = emptyMakerDraft(config.groups)

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-emerald-700">新弾カードTier表メーカー</p>
        <h1 className="mt-2 text-2xl font-black">DM26-EX2 悪感謝祭 カリスマBEST Tier表</h1>
        <p className="mt-1 text-sm text-gray-500">好きな評価グループに分けてオリジナルのTier表を作れます。</p>
        <PublicTierMaker
          cards={cards}
          groups={config.groups}
          initialDraft={draft}
          unrated={config.unrated}
          canSave={Boolean(user) || config.allowAnonymousSubmission}
          saveAction={savePublicTierSubmission}
          saveButtonLabel="登録"
          hasSavedSubmission={false}
          aggregates={[]}
        />
      </div>
    </main>
  )
}
