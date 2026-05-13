import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { Header } from '@/components/Header'
import { SnsFloatingBar } from '@/components/SnsFloatingBar'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-config'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

const GA_ID = 'G-HDGDNYNMH4'
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

export const metadata: Metadata = {
  title: 'デュエマ掲示板 | デュエルマスターズ専門掲示板',
  description: 'デュエルマスターズ（デュエマ）専門の掲示板。デッキ相談・カード評価・大会情報・環境考察など何でも語ろう。',
  metadataBase: new URL(SITE_URL),
  keywords: ['デュエマ', 'デュエルマスターズ', '掲示板', 'デッキ', 'カード', '大会', '環境', 'BBS'],
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [{ url: '/logo.jpg', type: 'image/jpeg' }],
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
  openGraph: {
    title: 'デュエマ掲示板 | デュエルマスターズ専門掲示板',
    description: 'デュエルマスターズ（デュエマ）専門の掲示板。デッキ相談・カード評価・大会情報など何でも語ろう。',
    url: SITE_URL,
    siteName: 'デュエマ掲示板',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: 'デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'デュエマ掲示板 | デュエルマスターズ専門掲示板',
    description: 'デュエルマスターズ（デュエマ）専門の掲示板。デッキ相談・カード評価・大会情報など何でも語ろう。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
  verification: {
    google: 'fYOcWqqCUBFXoIWN_0CMoALvbJnuUcTpvdf01SGgLNM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 構造化データ：GoogleがサイトをVercelではなく「デュエマ掲示板」と認識するために必要 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'デュエマ掲示板',
              alternateName: 'デュエルマスターズ専門掲示板',
              url: SITE_URL,
              description: 'デュエルマスターズ（デュエマ）専門の掲示板。デッキ相談・カード評価・大会情報・環境考察など何でも語ろう。',
              inLanguage: 'ja',
              publisher: {
                '@type': 'Organization',
                name: 'デュエマ掲示板',
                url: SITE_URL,
                logo: {
                  '@type': 'ImageObject',
                  url: `${SITE_URL}/logo.jpg`,
                },
              },
            }),
          }}
        />

        {/* Supabase ストレージへの早期接続でLCPの画像取得を高速化 */}
        <link rel="preconnect" href="https://nodgfukqvuwvgfnlzvnh.supabase.co" />
        <link rel="dns-prefetch" href="https://nodgfukqvuwvgfnlzvnh.supabase.co" />

        {/* Google Analytics (GA4) — lazyOnload でTBTへの影響を排除 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="lazyOnload"
        />
        <Script id="ga4-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>

        {/* Service Worker 登録 — PWA「ホームに追加」対応 */}
        <Script id="sw-register" strategy="lazyOnload">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `}
        </Script>

        {/* Microsoft Clarity — lazyOnload でTTIへの影響を排除 */}
        <Script id="clarity-init" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wd3kzmwhnm");
          `}
        </Script>
        {POSTHOG_KEY && (
          <Script id="posthog-init" strategy="lazyOnload">
            {`
              !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags reloadFeatureFlags group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
              posthog.init('${POSTHOG_KEY}', {
                api_host: '${POSTHOG_HOST}',
                person_profiles: 'identified_only',
                capture_pageview: true
              });
            `}
          </Script>
        )}
      </head>
      <body className="min-h-screen flex flex-col antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <Header />
          <main className="flex-1">{children}</main>
          <SnsFloatingBar />
          <footer className="bg-white border-t border-gray-200 py-4 mt-6">
            <div className="max-w-screen-xl mx-auto px-3 text-center text-xs text-gray-600 space-y-1">
              <div className="flex justify-center gap-4">
                <Link href="/terms" className="hover:underline">利用規約</Link>
                <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
                <Link href="/contact" className="hover:underline">お問い合わせ</Link>
              </div>
              <div>©<Link href="/">デュエマ掲示板</Link> — デュエル・マスターズ専門掲示板</div>
            </div>
          </footer>
          <Analytics />
          <SpeedInsights />
      </body>
    </html>
  )
}
