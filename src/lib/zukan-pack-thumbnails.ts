const PACK_THUMBNAILS: Record<string, string> = {
  'dm-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dm01.jpg',
  'dm-02': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dm02.jpg',
  'dmr-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/old/dmr01.jpg',
  'dmrp-01': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dmrp01/thumb.png',
  'dm22-rp1': 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm22rp1/thumb.png',
}

const PACK_SLUG_BY_CODE: Record<string, string> = {
  'DM-01': 'dm-01',
  'DM-02': 'dm-02',
  'DMR-01': 'dmr-01',
  'DMRP-01': 'dmrp-01',
  'DM22-RP1': 'dm22-rp1',
}

export function getZukanPackThumbnail(packSlug: string): string | null {
  return PACK_THUMBNAILS[packSlug] ?? null
}

export function getZukanPackThumbnailByCode(packCode: string): string | null {
  const packSlug = PACK_SLUG_BY_CODE[packCode]
  return packSlug ? getZukanPackThumbnail(packSlug) : null
}
