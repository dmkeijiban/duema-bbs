import type { Metadata } from 'next'
import DeckMaker from './DeckMaker'
export const metadata:Metadata={title:'全カード対応デッキメーカー｜デュエマ掲示板',description:'カード名・読み仮名から検索して40枚デッキを作り、端末保存・PNG保存できます。'}
export default function Page(){return <main className="min-h-screen bg-slate-100 px-3 py-6"><div className="mx-auto max-w-7xl"><p className="text-xs font-black text-emerald-700">デュエル・マスターズ</p><h1 className="mt-1 text-2xl font-black">全カード対応デッキメーカー</h1><p className="mb-5 mt-2 text-sm text-slate-600">カードを検索して40枚デッキを作成。内容はこの端末に自動保存されます。</p><DeckMaker/></div></main>}
