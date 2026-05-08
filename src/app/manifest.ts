import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'デュエマ掲示板',
    short_name: 'デュエマBBS',
    description: 'デュエルマスターズ専門掲示板。デッキ相談・カード評価・大会情報など何でも語ろう。',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9fa',
    theme_color: '#ffffff',
    lang: 'ja',
    icons: [
      {
        src: '/logo.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/logo.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  }
}
