export type ZukanCardFace = {
  side: 'front' | 'back'
  name: string
  cardNumber: string
  cardType: string
  civilization: string
  cost: number | null
  mana: number | null
  race: string | null
  power: string | null
  rarity: string | null
  illustrator: string | null
  abilityText: string | null
  flavorText: string | null
  imageUrl: string
  officialPageUrl: string
}

type MultiFaceSupplement = {
  officialCardId: string
  frontImageUrl: string
  back: Omit<ZukanCardFace, 'side' | 'officialPageUrl'>
}

const GALLOWS_ABILITY = `相手プレイヤーはコストを支払わずにクリーチャーを召喚したり呪文を唱えたりできない。

このクリーチャーが攻撃する時、バトルゾーンにあるクリーチャーを２体まで選び、持ち主の手札に戻してもよい。

T・ブレイカー(このクリーチャーはシールドを３枚ブレイクする)

リンク解除(このクリーチャーがバトルゾーンを離れる時、そのサイキック・セルのいずれか１枚を選んで超次元ゾーンに戻し、残りのカードを裏返す)

※覚醒リンクするために必要なカード(ガロウズ・セブ・カイザー/竜骨なる者ザビ・リゲル/ハイドラ・ギルザウルス)`

const GAIAAR_ABILITY = `このクリーチャーが攻撃する時、このクリーチャーよりパワーが小さい相手のクリーチャーをすべて破壊する。

ワールド・ブレイカー(このクリーチャーは相手のシールドをすべてブレイクする)

リンク解除(このクリーチャーがバトルゾーンを離れる時、そのサイキック・セルのいずれか１枚を選んで超次元ゾーンに戻し、残りのカードを裏返す)

※覚醒リンクするために必要なカード(ガイアール・カイザー/ブーストグレンオー/ドラゴニック・ピッピー)`

const PACKUN_ABILITY = `相手のクリーチャーが攻撃する時、このクリーチャーをアンタップする。

相手のクリーチャーが攻撃している間、このクリーチャーは「ブロッカー」を得る。

W・ブレイカー(このクリーチャーはシールドを２枚ブレイクする)

リンク解除(このクリーチャーがバトルゾーンを離れる時、そのサイキック・セルのいずれか１枚を選んで超次元ゾーンに戻し、残りのカードを裏返す)

※覚醒リンクするために必要なカード(イオの伝道師ガガ・パックン/タイタンの大地ジオ・ザ・マン)`

const MARSHMALLOW_ABILITY = `W・ブレイカー(このクリーチャーはシールドを２枚ブレイクする)

リンク解除(このクリーチャーがバトルゾーンを離れる時、そのサイキック・セルのいずれか１枚を選んで超次元ゾーンに戻し、残りのカードを裏返す)

※覚醒リンクするために必要なカード(マシュマロ人形ザビ・ポリマ/ギル・ポリマのペンチ)`

function officialUrl(id: string) {
  return `https://dm.takaratomy.co.jp/card/detail/?id=${id}`
}

function backFace(
  name: string,
  cardNumber: string,
  cardType: string,
  civilization: string,
  cost: number,
  race: string,
  power: string,
  rarity: string,
  abilityText: string,
  imageUrl: string,
): MultiFaceSupplement['back'] {
  return { name, cardNumber, cardType, civilization, cost, mana: null, race, power, rarity, illustrator: null, abilityText, flavorText: null, imageUrl }
}

export const MULTI_FACE_CARDS: Record<string, MultiFaceSupplement> = {
  'dmr01-001': { officialCardId: 'dmr01-v01', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-v01a.jpg', back: backFace('死海竜ガロウズ・デビルドラゴン', 'V1/V2', 'サイキック・スーパー・クリーチャー', '水/闇/火', 24, 'デビル・コマンド・ドラゴン/エイリアン', '12000', 'VIC', GALLOWS_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-v01b.jpg') },
  'dmr01-002': { officialCardId: 'dmr01-v02', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-v02a.jpg', back: backFace('激竜王ガイアール・オウドラゴン', 'V2/V2', 'サイキック・スーパー・クリーチャー', '火', 24, 'キング・コマンド・ドラゴン/ハンター', '25000', 'VIC', GAIAAR_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-v02b.jpg') },
  'dmr01-051': { officialCardId: 'dmr01-041', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-041a.jpg', back: backFace('貪欲バリバリ・パックンガー', '41/110', 'サイキック・スーパー・クリーチャー', '光/自然', 15, 'ガイア・コマンド/バーサーカー/エイリアン', '10500', 'U', PACKUN_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-041b.jpg') },
  'dmr01-063': { officialCardId: 'dmr01-053', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-053a.jpg', back: backFace('死海竜ガロウズ・デビルドラゴン', '53/110', 'サイキック・スーパー・クリーチャー', '水/闇/火', 24, 'デビル・コマンド・ドラゴン/エイリアン', '12000', 'U', GALLOWS_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-053b.jpg') },
  'dmr01-064': { officialCardId: 'dmr01-054', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-054a.jpg', back: backFace('幻惑の魔手ドン・マシュマロ', '54/110', 'サイキック・クリーチャー', '闇/火', 9, 'デスパペット/ゼノパーツ/エイリアン', '6000', 'U', MARSHMALLOW_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-054b.jpg') },
  'dmr01-069': { officialCardId: 'dmr01-059', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-059a.jpg', back: backFace('死海竜ガロウズ・デビルドラゴン', '59/110', 'サイキック・スーパー・クリーチャー', '水/闇/火', 24, 'デビル・コマンド・ドラゴン/エイリアン', '12000', 'U', GALLOWS_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-059b.jpg') },
  'dmr01-070': { officialCardId: 'dmr01-060', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-060a.jpg', back: backFace('激竜王ガイアール・オウドラゴン', '60/110', 'サイキック・スーパー・クリーチャー', '火', 24, 'キング・コマンド・ドラゴン/ハンター', '25000', 'U', GAIAAR_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-060b.jpg') },
  'dmr01-071': { officialCardId: 'dmr01-061', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-061a.jpg', back: backFace('幻惑の魔手ドン・マシュマロ', '61/110', 'サイキック・クリーチャー', '闇/火', 9, 'デスパペット/ゼノパーツ/エイリアン', '6000', 'U', MARSHMALLOW_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-061b.jpg') },
  'dmr01-072': { officialCardId: 'dmr01-062', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-062a.jpg', back: backFace('激竜王ガイアール・オウドラゴン', '62/110', 'サイキック・スーパー・クリーチャー', '火', 24, 'キング・コマンド・ドラゴン/ハンター', '25000', 'U', GAIAAR_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-062b.jpg') },
  'dmr01-075': { officialCardId: 'dmr01-065', frontImageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-065a.jpg', back: backFace('貪欲バリバリ・パックンガー', '65/110', 'サイキック・スーパー・クリーチャー', '光/自然', 15, 'ガイア・コマンド/バーサーカー/エイリアン', '10500', 'U', PACKUN_ABILITY, 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmr01-065b.jpg') },
}

export function getMultiFaceSupplement(slug: string) {
  const supplement = MULTI_FACE_CARDS[slug]
  if (!supplement) return null
  return {
    ...supplement,
    officialPageUrl: officialUrl(supplement.officialCardId),
    back: { ...supplement.back, side: 'back' as const, officialPageUrl: officialUrl(supplement.officialCardId) },
  }
}

export function getProxiedZukanCardImageUrl(imageUrl: string) {
  const filename = new URL(imageUrl).pathname.split('/').pop()
  return filename ? `/api/zukan/card-image/${encodeURIComponent(filename)}` : imageUrl
}
