export type ZukanProduct = {
  url: string
}

const PRODUCTS: Record<string, ZukanProduct> = {
  'dm-01': { url: 'https://dm.takaratomy.co.jp/product/dm01/' },
  'dm-02': { url: 'https://dm.takaratomy.co.jp/product/dm02/' },
  'dmr-01': { url: 'https://dm.takaratomy.co.jp/product/dmr01/' },
  'dmrp-01': { url: 'https://dm.takaratomy.co.jp/product/dmrp01/' },
  'dm22-rp1': { url: 'https://dm.takaratomy.co.jp/product/dm22rp1/' },
}

export function getZukanProduct(packSlug: string): ZukanProduct | null {
  return PRODUCTS[packSlug] ?? null
}

export function getZukanProductImagePath(packSlug: string): string | null {
  return PRODUCTS[packSlug] ? `/api/zukan/product-image/${encodeURIComponent(packSlug)}` : null
}
