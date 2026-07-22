import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  DUEMA_GENERATIONS,
  DUEMA_CIVILIZATIONS,
  DUEMA_PLAY_STYLES,
  type DuemaOption,
} from '@/lib/duema-profile'
import { RESUME_MAKER_SLUG } from '@/lib/maker-resume'

const ADMIN_COOKIE = 'admin_auth'

function StatTable({
  label,
  options,
  counts,
  filled,
}: {
  label: string
  options: readonly DuemaOption[]
  counts: Record<string, number>
  filled: number
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold text-gray-700">
        {label}
        <span className="ml-1.5 text-xs font-normal text-gray-400">設定済み: {filled}人</span>
      </h2>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">選択肢</th>
              <th className="px-3 py-2 text-right font-medium w-20">人数</th>
              <th className="px-3 py-2 text-right font-medium w-20">割合</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {options.map(o => {
              const count = counts[o.value] ?? 0
              const pct = filled > 0 ? Math.round((count / filled) * 100) : 0
              return (
                <tr key={o.value} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800">{o.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">{count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default async function DuemaStatsPage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const admin = createAdminClient()
  const [{ data: rows }, { data: resumeProject }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, duema_generation, favorite_civilization, play_style, favorite_card')
      .eq('account_suspended', false)
      .is('withdrawn_at', null)
      .limit(5000),
    admin
      .from('maker_projects')
      .select('id')
      .eq('slug', RESUME_MAKER_SLUG)
      .eq('type', 'resume')
      .maybeSingle(),
  ])

  const all = rows ?? []
  const total = all.length
  const activeUserIds = new Set(all.map(profile => profile.id))
  const { data: resumeRows } = resumeProject
    ? await admin
        .from('maker_submissions')
        .select('user_id, resume_data')
        .eq('project_id', resumeProject.id)
        .eq('is_overwrite_slot', true)
        .eq('is_valid', true)
        .not('user_id', 'is', null)
        .limit(5000)
    : { data: [] }
  const resumes = (resumeRows ?? []).filter(row => row.user_id && activeUserIds.has(row.user_id))

  const generationCounts: Record<string, number> = {}
  const civilizationCounts: Record<string, number> = {}
  const playStyleCounts: Record<string, number> = {}
  let generationFilled = 0
  let civilizationFilled = 0
  let playStyleFilled = 0
  let favoriteCardCount = 0

  for (const p of all) {
    if (p.duema_generation) {
      generationCounts[p.duema_generation] = (generationCounts[p.duema_generation] ?? 0) + 1
      generationFilled++
    }
    if (p.favorite_civilization) {
      civilizationCounts[p.favorite_civilization] = (civilizationCounts[p.favorite_civilization] ?? 0) + 1
      civilizationFilled++
    }
    if (p.play_style) {
      playStyleCounts[p.play_style] = (playStyleCounts[p.play_style] ?? 0) + 1
      playStyleFilled++
    }
    if (p.favorite_card) favoriteCardCount++
  }

  const countResumeChoice = (
    value: unknown,
    options: readonly DuemaOption[],
    counts: Record<string, number>,
  ) => {
    if (typeof value !== 'string' || !value) return false
    const option = options.find(item => item.label === value || item.value === value)
    if (!option) return false
    counts[option.value] = (counts[option.value] ?? 0) + 1
    return true
  }

  for (const submission of resumes) {
    const resume = submission.resume_data && typeof submission.resume_data === 'object'
      ? submission.resume_data as Record<string, unknown>
      : {}
    if (countResumeChoice(resume.generation, DUEMA_GENERATIONS, generationCounts)) generationFilled++
    if (countResumeChoice(resume.favoriteCivilization, DUEMA_CIVILIZATIONS, civilizationCounts)) civilizationFilled++
    if (countResumeChoice(resume.playStyle, DUEMA_PLAY_STYLES, playStyleCounts)) playStyleFilled++
  }

  const totalWithAny = all.filter(
    p => p.duema_generation || p.favorite_card || p.favorite_civilization || p.play_style
  ).length

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-sm">
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/admin" className="text-blue-600 hover:underline">管理画面</Link>
        <span>/</span>
        <span>デュエマプロフィール統計</span>
      </div>
      <h1 className="mb-4 text-lg font-bold text-gray-800">📊 デュエマプロフィール統計</h1>

      <div className="mb-6 flex flex-wrap gap-4 text-xs text-gray-600 rounded border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span>有効ユーザー: <strong className="text-gray-800">{total}人</strong></span>
        <span>いずれか設定済み: <strong className="text-gray-800">{totalWithAny}人</strong></span>
        <span>好きなカード入力済み: <strong className="text-gray-800">{favoriteCardCount}人</strong></span>
        <span>保存済み履歴書: <strong className="text-gray-800">{resumes.length}人</strong></span>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        世代・好きな文明・プレイスタイルは、プロフィール回答と履歴書回答を合算しています。同じ人が両方で回答した場合は、それぞれ1件として集計します。
      </p>

      <StatTable
        label="どの世代？"
        options={DUEMA_GENERATIONS}
        counts={generationCounts}
        filled={generationFilled}
      />
      <StatTable
        label="好きな文明"
        options={DUEMA_CIVILIZATIONS}
        counts={civilizationCounts}
        filled={civilizationFilled}
      />
      <StatTable
        label="プレイスタイル"
        options={DUEMA_PLAY_STYLES}
        counts={playStyleCounts}
        filled={playStyleFilled}
      />
    </div>
  )
}
