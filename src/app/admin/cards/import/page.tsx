import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import CardImportClient from './CardImportClient'

export const metadata: Metadata = { title: '共通カード取り込み（非公開）', robots: { index: false, follow: false } }

export default async function CardImportPage() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  return <main className="mx-auto max-w-7xl px-3 py-6"><Link href="/admin" className="text-sm font-bold text-blue-700">← 管理画面へ</Link><h1 className="mt-3 text-2xl font-black">共通カード取り込み</h1><p className="mt-1 text-sm text-gray-600">メーカー機能用の代表カードをJSONから検証・取り込みします。書き込みはPreview環境のみです。</p><CardImportClient /></main>
}
