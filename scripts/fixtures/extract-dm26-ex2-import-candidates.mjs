import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('./dm26-ex2-official-preview.reviewed.json', import.meta.url);
const rows = JSON.parse(await readFile(sourceUrl, 'utf8'));
const standard = rows.filter((row) => row.illustration_variant === 'standard');
const mainSpr = rows.filter((row) => /^SPR[1-5]\/SPR5$/.test(row.card_number));
const variants = rows.filter((row) => row.review_status === 'variant_only');

const normalizeName = (value) => value.normalize('NFKC').replace(/[\s　]+/g, '').replace(/[／/]/g, '／');
const standardByName = new Map(standard.map((row) => [normalizeName(row.card_name), row]));

const toCandidate = (row) => {
  const unresolvedFields = ['civilization', 'cost', 'card_type'].filter((field) => row[field] === null);
  return {
    card_number: row.card_number,
    card_name: row.card_name,
    image_url: row.source_image_url,
    civilization: row.civilization,
    cost: row.cost,
    card_type: row.card_type,
    rarity: /^SPR[1-5]\/SPR5$/.test(row.card_number) ? 'SPR' : row.rarity,
    is_twinpact: row.is_twinpact,
    review_status: unresolvedFields.length ? 'needs_review' : 'confirmed',
    unresolved_fields: unresolvedFields,
    field_sources: row.field_sources
  };
};

// SPR1〜SPR5は別イラストではなく、この商品のメインとなる固有カード。
// 既存89枚の相対順と番号を変えず、カードプール先頭へ追加する。
const candidates = [...mainSpr, ...standard].map(toCandidate);

const variantMap = variants.map((row) => {
  const base = standardByName.get(normalizeName(row.card_name));
  return {
    variant_card_number: row.card_number,
    card_name: row.card_name,
    source_image_url: row.source_image_url,
    canonical_standard_card_number: base?.card_number ?? null,
    canonical_standard_card_name: base?.card_name ?? row.card_name,
    illustration_variant: row.illustration_variant,
    finish_variant: row.finish_variant,
    review_status: 'variant_only',
    included_in_tier_pool: /^SPR[1-5]\/SPR5$/.test(row.card_number),
    review_note: base
      ? '通常89種内の同名カードへ名称一致で対応。DB登録前に画像で同一カード性を再確認する。'
      : '通常89種内に同名カードがないため、将来の共通カード本体へ名称をキー候補として紐付ける。'
  };
});

const unresolved = candidates
  .filter((row) => row.unresolved_fields.length)
  .map(({ card_number, card_name, unresolved_fields }) => ({ card_number, card_name, unresolved_fields }));

if (mainSpr.length !== 5) throw new Error(`expected 5 main SPR cards, got ${mainSpr.length}`);
if (candidates.length !== 94) throw new Error(`expected 94 candidates, got ${candidates.length}`);
if (variantMap.length !== 60) throw new Error(`expected 60 variants, got ${variantMap.length}`);
const numbers = candidates.map((row) => Number(row.card_number.split('/')[0]));
const missing = Array.from({ length: 89 }, (_, index) => index + 1).filter((number) => !numbers.includes(number));
if (missing.length) throw new Error(`missing standard numbers: ${missing.join(', ')}`);

await Promise.all([
  writeFile(new URL('./dm26-ex2-standard-89.import-candidates.json', import.meta.url), `${JSON.stringify(candidates, null, 2)}\n`),
  writeFile(new URL('./dm26-ex2-variants-60.json', import.meta.url), `${JSON.stringify(variantMap, null, 2)}\n`),
  writeFile(new URL('./dm26-ex2-standard-89.needs-review.json', import.meta.url), `${JSON.stringify(unresolved, null, 2)}\n`)
]);

console.log(JSON.stringify({
  source_rows: rows.length,
  import_candidates: candidates.length,
  main_spr_cards: mainSpr.length,
  variants_excluded_from_tier_pool: variantMap.length,
  variants_linked_to_standard_by_name: variantMap.filter((row) => row.canonical_standard_card_number).length,
  needs_review: unresolved.length,
  missing_standard_numbers: missing
}, null, 2));
