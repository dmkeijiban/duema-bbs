#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const line of (await readFile(process.env.ENV_FILE ?? '.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('環境ファイルにSupabase URLとService Roleキーが必要です（値は出力しません）')
const outputPath = resolve(process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'data/cards/card-printings.json')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const rows = []
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await supabase.from('card_printings').select('id,card_id,source_key,official_page_url,updated_at').order('id').range(offset, offset + 999)
  if (error) throw error
  rows.push(...data)
  if (data.length < 1000) break
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, printings: rows.length }, null, 2))
