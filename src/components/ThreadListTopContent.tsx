import { Suspense } from 'react'
import Link from 'next/link'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { getCachedSetting } from '@/lib/cached-queries'
import { SITE_URL } from '@/lib/site-config'

const HOME_BANNER_DEFAULT = '<p>デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。初めての方は<a target="_blank" rel="noopener noreferrer" href={`${SITE_URL}/guide`}>スレッドの立て方</a>をご確認ください。</p>'

function HomeBannerFallback() {
  return (
    <div
      className="mb-2 px-3 py-2 text-sm border relative setting-content"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}
    >
      <div>
        <p>デュエルマスターズ専門の掲示板です。デッキ相談・カード評価・大会情報など何でもどうぞ。初めての方は<a target="_blank" rel="noopener noreferrer" href={`${SITE_URL}/guide`}>スレッドの立て方</a>をご確認ください。</p>
      </div>
    </div>
  )
}

async function HomeBannerServer() {
  const banner = await getCachedSetting('home_banner', HOME_BANNER_DEFAULT)
  const text = banner || HOME_BANNER_DEFAULT
  const isHtml = text.trimStart().startsWith('<')
  return (
    <div
      className="mb-2 px-3 py-2 text-sm border relative setting-content"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb', whiteSpace: isHtml ? undefined : 'pre-wrap' }}
    >
      {isHtml ? <div dangerouslySetInnerHTML={{ __html: text }} /> : text}
    </div>
  )
}

export async function ThreadListTopContent({ showPopularThreads = true }: { showPopularThreads?: boolean }) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      <Suspense fallback={<RecommendSectionSkeleton />}>
        <RecommendSection />
      </Suspense>
      <Suspense fallback={<HomeBannerFallback />}>
        <HomeBannerServer />
      </Suspense>
      {showPopularThreads && (
        <Link
          href="/summary"
          className="mb-2 flex items-center justify-between px-3 py-2 border border-blue-200 bg-blue-50 text-sm text-gray-900 hover:bg-blue-100 transition-colors"
        >
          <span>📊 人気スレッドまとめ（週間・月間ランキング）</span>
          <span className="text-xs ml-2 shrink-0">一覧へ</span>
        </Link>
      )}
    </div>
  )
}
