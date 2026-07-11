export type ZukanTwinPactSpellFace = {
  name: string
  cost: number
  abilityText: string
}

export const TWIN_PACT_SPELL_MARKER = '【呪文面】'
const TWIN_PACT_SPELL_HEADER = /^【呪文面】(.+?)（コスト\s*(\d+)）$/

const SPELL_FACES = {
  raphururuLove: {
    name: '「未来から来る、だからミラクル」',
    cost: 6,
    abilityText: 'カードを３枚引く。その後、コスト５以下の呪文を１枚、自分の手札からコストを支払わずに唱えてもよい。',
  },
  primalScream: {
    name: 'プライマル・スクリーム',
    cost: 4,
    abilityText: 'S・トリガー\n自分の山札の上から４枚を墓地に置く。その後、クリーチャーを１体、自分の墓地から手札に戻してもよい。',
  },
  duelistCharger: {
    name: '決闘者・チャージャー',
    cost: 3,
    abilityText: '自分の山札の上から３枚を表向きにする。その中から、名前に《ボルシャック》とあるカードをすべて手札に加え、残りを好きな順序で山札の下に置く。\nチャージャー（この呪文を唱えた後、墓地に置くかわりにマナゾーンに置く）',
  },
  superHeroTime: {
    name: '超英雄タイム',
    cost: 2,
    abilityText: 'バトルゾーンにある相手のコスト３以下のカードを１枚選び、持ち主の墓地に置く。',
  },
  gyautenAurora: {
    name: '逆転のオーロラ',
    cost: 5,
    abilityText: '自分のシールドを好きな数、マナゾーンに置く。',
  },
  emergencyTyphoon: {
    name: 'エマージェンシー・タイフーン',
    cost: 2,
    abilityText: 'S・トリガー（この呪文をシールドゾーンから手札に加える時、コストを支払わずにすぐ唱えてもよい）\nカードを２枚まで引く。その後、自分の手札を１枚捨てる。',
  },
} satisfies Record<string, ZukanTwinPactSpellFace>

export const TWIN_PACT_SPELL_FACES: Record<string, ZukanTwinPactSpellFace> = {
  'dm22rp1-sp2': SPELL_FACES.raphururuLove,
  'dm22rp1-tr4': SPELL_FACES.primalScream,
  'dm22rp1-t2': SPELL_FACES.duelistCharger,
  'dm22rp1-t3': SPELL_FACES.superHeroTime,
  'dm22rp1-t4': SPELL_FACES.gyautenAurora,
  'dm22rp1-t16': SPELL_FACES.emergencyTyphoon,
  'dm22rp1-tf2': SPELL_FACES.duelistCharger,
  'dm22rp1-tf3': SPELL_FACES.superHeroTime,
  'dm22rp1-tf4': SPELL_FACES.gyautenAurora,
  'dm22rp1-tf16': SPELL_FACES.emergencyTyphoon,
}

export function splitTwinPactAbilityText(abilityText: string | null | undefined) {
  if (!abilityText?.includes(TWIN_PACT_SPELL_MARKER)) {
    return { creatureAbilityText: abilityText ?? null, spellFace: null }
  }

  const [creatureText, spellSection] = abilityText.split(TWIN_PACT_SPELL_MARKER, 2)
  const [header = '', ...abilityLines] = spellSection.trim().split(/\r?\n/)
  const match = `${TWIN_PACT_SPELL_MARKER}${header}`.match(TWIN_PACT_SPELL_HEADER)
  if (!match || abilityLines.join('\n').trim().length === 0) {
    return { creatureAbilityText: abilityText, spellFace: null }
  }

  return {
    creatureAbilityText: creatureText.trim() || null,
    spellFace: {
      name: match[1].trim(),
      cost: Number(match[2]),
      abilityText: abilityLines.join('\n').trim(),
    } satisfies ZukanTwinPactSpellFace,
  }
}

export function getTwinPactSpellFace(slug: string, abilityText?: string | null) {
  return splitTwinPactAbilityText(abilityText).spellFace ?? TWIN_PACT_SPELL_FACES[slug] ?? null
}
