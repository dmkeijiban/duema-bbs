const PACK_THUMBNAILS: Record<string, string> = {
  'dm-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dm01.jpg',
  'dm-02': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dm02.jpg',
  'dmr-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dmr01.jpg',
  'dmrp-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dmrp01/thumb.png',
  'dm22-rp1': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm22rp1/thumb.png',
}

export function getZukanPackThumbnail(packSlug: string): string | null {
  return PACK_THUMBNAILS[packSlug] ?? null
}
