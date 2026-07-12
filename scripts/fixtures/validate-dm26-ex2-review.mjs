import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';

const file = new URL('./dm26-ex2-official-preview.reviewed.json', import.meta.url);
const rows = JSON.parse(await readFile(file, 'utf8'));
const schema = JSON.parse(await readFile(new URL('./dm26-ex2-review.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
ajv.addFormat('uri', /^https?:\/\//);
const schemaValid = ajv.validate(schema, rows);
const statuses = new Set(['confirmed', 'needs_review', 'variant_only']);
const required = ['source_image_url','card_number','card_name','civilization','cost','card_type','rarity','is_twinpact','illustration_variant','finish_variant','review_status','review_note','field_sources','source_conflict','source_conflict_note'];

const errors = [];
if (!Array.isArray(rows) || rows.length !== 149) errors.push(`row count: expected 149, got ${rows.length}`);
for (const [i, row] of rows.entries()) {
  for (const key of required) if (!(key in row)) errors.push(`row ${i + 1}: missing ${key}`);
  if (!statuses.has(row.review_status)) errors.push(`row ${i + 1}: invalid review_status`);
  if (typeof row.card_name !== 'string' || !row.card_name) errors.push(`row ${i + 1}: invalid card_name`);
  if (!(row.cost === null || Number.isInteger(row.cost))) errors.push(`row ${i + 1}: invalid cost`);
}

const standard = rows.filter((row) => row.illustration_variant === 'standard');
const numbers = standard.map((row) => Number(row.card_number?.split('/')[0])).sort((a,b)=>a-b);
const missing = Array.from({ length: 89 }, (_, i) => i + 1).filter((n) => !numbers.includes(n));
const duplicateNumbers = numbers.filter((n, i) => numbers.indexOf(n) !== i);
const identity = new Map();
const duplicateIdentity = [];
for (const row of rows) {
  const key = `${row.card_number ?? 'unconfirmed'}\u0000${row.card_name}`;
  if (identity.has(key)) duplicateIdentity.push({ key, first: identity.get(key), duplicate: row.source_image_url });
  else identity.set(key, row.source_image_url);
}

const result = {
  rows: rows.length,
  unique_card_identities: identity.size,
  standard_cards: standard.length,
  standard_number_missing: missing,
  standard_number_duplicates: [...new Set(duplicateNumbers)],
  duplicate_identity_count: duplicateIdentity.length,
  needs_review: rows.filter((r) => r.review_status === 'needs_review').length,
  variant_only: rows.filter((r) => r.review_status === 'variant_only').length,
  confirmed: rows.filter((r) => r.review_status === 'confirmed').length,
  source_conflicts: rows.filter((r) => r.source_conflict).map((r) => ({ card_number: r.card_number, card_name: r.card_name, note: r.source_conflict_note })),
  field_source_counts: ['card_number','card_name','rarity','civilization','cost','card_type'].reduce((result, field) => {
    result[field] = { official: 0, dmwiki: 0, unresolved: 0 };
    for (const row of rows) result[field][row.field_sources[field]] += 1;
    return result;
  }, {}),
  needs_review_rows: rows.filter((r) => r.review_status === 'needs_review').map((r) => ({ card_number: r.card_number, card_name: r.card_name })),
  variant_only_rows: rows.filter((r) => r.review_status === 'variant_only').map((r) => ({ card_number: r.card_number, card_name: r.card_name })),
  schema_valid: schemaValid,
  schema_errors: ajv.errors ?? [],
  null_counts: Object.fromEntries(required.map((key) => [key, rows.filter((r) => r[key] === null).length])),
  errors
};
console.log(JSON.stringify(result, null, 2));
if (errors.length || missing.length || duplicateNumbers.length || !schemaValid) process.exitCode = 1;
