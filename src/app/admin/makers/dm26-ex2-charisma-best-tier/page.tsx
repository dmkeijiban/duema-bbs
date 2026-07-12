import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import {
  emptyMakerDraft,
  parseMakerProjectConfig,
  TIER_GROUPS,
  type MakerCard,
  type MakerDraft,
  type MakerProjectConfig,
} from '@/lib/maker'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import TierMaker from './TierMaker'

export const metadata: Metadata = {
  title: 'DM26-EX2 Tier表（非公開）',
  robots: { index: false, follow: false },
}

type ProjectRow = {
  id: string
  config: unknown
}

type LinkRow = {
  cards: {
    id: string
    name: string
    image_url: string | null
    civilization: string[] | null
    cost: number | null
    card_type: string | null
  }
}

type SubmissionItem = {
  card_id: string
  group_key: string
  position: number
}

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let cards: MakerCard[] = []
  let projectConfig: MakerProjectConfig = {
    groups: TIER_GROUPS,
    unrated: true,
    allowDuplicates: false,
    ordered: true,
    overwrite: true,
    maxChoices: null,
  }
  let draft: MakerDraft = emptyMakerDraft(projectConfig.groups)
  let unavailableMessage = ''

  try {
    const admin = createAdminClient()
    const { data: projectData, error: projectError } = await admin
      .from('maker_projects')
      .select('id,config')
      .eq('slug', 'dm26-ex2-charisma-best-tier')
      .single()

    if (projectError || !projectData) {
      throw new Error('Tier表企画がまだ準備されていません')
    }

    const project = projectData as ProjectRow
    projectConfig = parseMakerProjectConfig(project.config)
    draft = emptyMakerDraft(projectConfig.groups)

    const { data: links, error: linksError } = await admin
      .from('maker_project_cards')
      .select('sort_order,cards!inner(id,name,image_url,civilization,cost,card_type,is_active)')
      .eq('project_id', project.id)
      .eq('cards.is_active', true)
      .order('sort_order')

    if (linksError) throw new Error('企画カードを取得できませんでした')

    cards = ((links ?? []) as unknown as LinkRow[]).map(link => ({
      id: link.cards.id,
      name: link.cards.name,
      imageUrl: link.cards.image_url,
      civilization: link.cards.civilization ?? [],
      cost: link.cards.cost,
      cardType: link.cards.card_type,
    }))

    if (user) {
      const { data: submission, error: submissionError } = await admin
        .from('maker_submissions')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (submissionError) throw new Error('保存済みTier表を確認できませんでした')

      if (submission) {
        const { data: items, error: itemsError } = await admin
          .from('maker_submission_items')
          .select('card_id,group_key,position')
          .eq('submission_id', submission.id)
          .order('position')

        if (itemsError) throw new Error('保存済みTier表を読み込めませんでした')

        const validCardIds = new Set(cards.map(card => card.id))
        const seen = new Set<string>()

        for (const item of (items ?? []) as SubmissionItem[]) {
          if (!draft[item.group_key] || !validCardIds.has(item.card_id) || seen.has(item.card_id)) continue
          seen.add(item.card_id)
          draft[item.group_key].push(item.card_id)
        }
      }
    }
  } catch (error) {
    unavailableMessage = error instanceof Error ? error.message : 'Tier表を読み込めませんでした'
    console.error('DM26-EX2 Tier表の読み込みに失敗しました', {
      message: unavailableMessage,
    })
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-blue-700">管理者限定 · Preview</p>
        <h1 className="mt-2 text-2xl font-black">DM26-EX2 悪感謝祭 カリスマBEST Tier表</h1>
        <p className="mt-1 text-sm text-gray-500">
          新弾カードを{projectConfig.groups.map(group => group.label).join('〜')}に分類します。保存は1人1回答を上書きします。
        </p>

        {!user && (
          <p className="mt-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
            現在は確認用モードです。Tier表の操作と下書き保存はできますが、DBへの上書き保存だけ利用できません。
          </p>
        )}

        {unavailableMessage && (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            {unavailableMessage}
          </p>
        )}

        <TierMaker
          cards={cards}
          groups={projectConfig.groups}
          initialDraft={draft}
          unrated={projectConfig.unrated}
          canSave={Boolean(user)}
        />
      </div>
    </main>
  )
}
