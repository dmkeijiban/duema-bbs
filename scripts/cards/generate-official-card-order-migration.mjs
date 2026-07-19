#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ?? 'data/cards/official-card-order.json'
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'supabase/migrations/20260719090000_official_card_search_order.sql'
const verificationOutput = 'data/cards/verify-official-card-order.sql'
const parsed = JSON.parse(await readFile(input, 'utf8'))
if (!Array.isArray(parsed.rows) || parsed.rows.length !== parsed.official_total) throw new Error('公式全件の順序データが必要です')
if (new Set(parsed.rows.map((row) => row.source_key)).size !== parsed.rows.length) throw new Error('source_keyが重複しています')
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const chunks = []
for (let index = 0; index < parsed.rows.length; index += 500) {
  chunks.push(parsed.rows.slice(index, index + 500).map((row) => `(${quote(row.source_key)},${row.official_sort_position})`).join(',\n'))
}
const sql = `-- Official card search order captured from https://dm.takaratomy.co.jp/card/
alter table public.card_printings add column if not exists release_date date;
alter table public.card_printings add column if not exists official_sort_position integer;

create unique index if not exists card_printings_official_sort_position_uidx
  on public.card_printings(official_sort_position) where official_sort_position is not null;
create index if not exists card_printings_release_order_idx
  on public.card_printings(release_date desc nulls last, official_sort_position asc nulls last, id asc);

create temporary table official_card_order_stage(source_key text primary key, official_sort_position integer not null unique) on commit drop;
${chunks.map((values) => `insert into official_card_order_stage(source_key,official_sort_position) values\n${values};`).join('\n')}

update public.card_printings p
set official_sort_position = s.official_sort_position
from official_card_order_stage s
where p.source_key = s.source_key;

-- Latest product release date is confirmed on the official DM26-EX2 product page.
update public.card_printings set release_date = date '2026-07-18' where lower(source_key) like 'dm26ex2-%';

do $$
declare matched_count integer;
declare expected_matched integer;
begin
  select count(*) into matched_count from public.card_printings where official_sort_position is not null;
  select count(*) into expected_matched from official_card_order_stage s join public.card_printings p using(source_key);
  if matched_count <> expected_matched then
    raise exception 'official card order mismatch: DB %, expected matched %', matched_count, expected_matched;
  end if;
end $$;
`
await writeFile(output, sql)
const verificationSql = `with official(source_key,position) as (values\n${parsed.rows.map((row) => `(${quote(row.source_key)},${row.official_sort_position})`).join(',\n')}\n)\nselect o.position,o.source_key from official o left join public.card_printings p using(source_key) where p.id is null order by o.position;\n`
await writeFile(verificationOutput, verificationSql)
console.log(JSON.stringify({ input, output, verificationOutput, rows: parsed.rows.length, bytes: Buffer.byteLength(sql) }))
