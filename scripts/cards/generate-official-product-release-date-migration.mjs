#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

const input = 'data/cards/official-product-release-dates.json'
const output = 'supabase/migrations/20260719100000_official_product_release_dates.sql'
const parsed = JSON.parse(await readFile(input, 'utf8'))
const dated = parsed.rows.filter((row) => row.release_date)
if (!dated.length) throw new Error('発売日データがありません')
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const values = dated.map((row) => `(${quote(row.set_code)},date ${quote(row.release_date)})`).join(',\n')
const sql = `-- Release dates verified from official product pages under https://dm.takaratomy.co.jp/product/.
create temporary table official_product_release_dates(set_code text primary key, release_date date not null) on commit drop;
insert into official_product_release_dates(set_code,release_date) values
${values};

update public.card_printings p
set release_date = d.release_date
from official_product_release_dates d
where lower(split_part(p.source_key,'-',1)) = d.set_code;
`
await writeFile(output, sql)
console.log(JSON.stringify({ input, output, dated_set_codes: dated.length, bytes: Buffer.byteLength(sql) }))
