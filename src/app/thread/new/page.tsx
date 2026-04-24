import { getCachedCategories } from '@/lib/cached-queries'
import { NewThreadFormClient } from './NewThreadFormClient'
import { ArrowLeft, PenSquare } from '@/components/Icons'
import Link from 'next/link'

export default async function NewThreadPage() {
  const categories = await getCachedCategories()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          スレッド一覧に戻る
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PenSquare className="w-5 h-5 text-indigo-600" />
            スレッドを立てる
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            タイトルと本文には日本語を含めてください（スパム対策）
          </p>
        </div>
        {/* 注意書き */}
        <div className="mx-6 mt-5 px-4 py-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-800 space-y-1 leading-relaxed">
          <p>・重複や似たスレッドがないか必ず確認してください。</p>
          <p>・単発スレは最終更新から一定時間で落ちます。</p>
          <p>・画像は権利を侵害しない物を添付してください。</p>
        </div>
        <NewThreadFormClient categories={categories} />
      </div>
    </div>
  )
}
