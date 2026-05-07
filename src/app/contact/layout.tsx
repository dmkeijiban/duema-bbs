import { SITE_URL } from '@/lib/site-config'

export const metadata = {
  title: 'お問い合わせ | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板へのお問い合わせはこちら。削除依頼・バグ報告・ご意見・ご要望など、お気軽にどうぞ。',
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'お問い合わせ | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板へのお問い合わせはこちら。削除依頼・バグ報告・ご意見・ご要望など、お気軽にどうぞ。',
    url: `${SITE_URL}/contact`,
    type: 'website' as const,
  },
  twitter: {
    card: 'summary' as const,
    title: 'お問い合わせ | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板へのお問い合わせはこちら。削除依頼・バグ報告・ご意見・ご要望など、お気軽にどうぞ。',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
