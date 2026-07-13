import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const sql = async (path) => db.exec(await readFile(new URL(path, import.meta.url), 'utf8'))
await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);')
await sql('../supabase/migrations/drafts/20260711_cards.sql')
await sql('../supabase/migrations/drafts/20260712_maker_tier.sql')
await sql('../supabase/migrations/20260713_01_hall_release_card_sync.sql')
await sql('../supabase/migrations/20260713_hall_of_fame_release_maker.sql')
// 冪等性: 同じ2本を再実行しても件数・IDが変わらないこと。
const before = await db.query("select source_key,id::text from cards where source_kind='takaratomy_card_id' order by source_key")
await sql('../supabase/migrations/20260713_01_hall_release_card_sync.sql')
await sql('../supabase/migrations/20260713_hall_of_fame_release_maker.sql')
const after = await db.query("select source_key,id::text from cards where source_kind='takaratomy_card_id' order by source_key")

const userId = '00000000-0000-4000-8000-000000000001'
await db.query('insert into auth.users(id) values ($1)', [userId])
const project = await db.query("select id::text from maker_projects where slug='hall-of-fame-release'")
const cards = await db.query("select c.id::text,c.regulation from maker_project_cards pc join cards c on c.id=pc.card_id where pc.project_id=$1 order by pc.sort_order", [project.rows[0].id])
await db.query("select save_maker_submission($1,$2,$3::jsonb)", [project.rows[0].id, userId, JSON.stringify([
  { card_id: cards.rows[0].id, group_key: 'release', position: 0 },
  { card_id: cards.rows[1].id, group_key: 'release', position: 1 },
])])
const first = await db.query("select (select count(*)::int from maker_submissions where project_id=$1 and user_id=$2) submissions,(select count(*)::int from maker_submission_items i join maker_submissions s on s.id=i.submission_id where s.project_id=$1 and s.user_id=$2) items", [project.rows[0].id, userId])
await db.query("select save_maker_submission($1,$2,$3::jsonb)", [project.rows[0].id, userId, JSON.stringify([
  { card_id: cards.rows[2].id, group_key: 'release', position: 0 },
])])
const updated = await db.query("select (select count(*)::int from maker_submissions where project_id=$1 and user_id=$2) submissions,(select count(*)::int from maker_submission_items i join maker_submissions s on s.id=i.submission_id where s.project_id=$1 and s.user_id=$2) items,(select i.card_id::text from maker_submission_items i join maker_submissions s on s.id=i.submission_id where s.project_id=$1 and s.user_id=$2 limit 1) selected", [project.rows[0].id, userId])
const aggregate = await db.query('select selection_count,submission_count,selection_rate::text from maker_selection_aggregates where project_id=$1 and card_id=$2', [project.rows[0].id, cards.rows[2].id])
const counts = {
  total: cards.rows.length,
  hall: cards.rows.filter(card => card.regulation === 'hall').length,
  premium: cards.rows.filter(card => card.regulation === 'premium_hall').length,
  stableIds: JSON.stringify(before.rows) === JSON.stringify(after.rows),
  first: first.rows[0], updated: updated.rows[0], aggregate: aggregate.rows[0],
}
if (counts.total !== 128 || counts.hall !== 89 || counts.premium !== 39 || !counts.stableIds) throw new Error(JSON.stringify(counts))
if (counts.first.submissions !== 1 || counts.first.items !== 2 || counts.updated.submissions !== 1 || counts.updated.items !== 1 || counts.updated.selected !== cards.rows[2].id) throw new Error(JSON.stringify(counts))
if (counts.aggregate.selection_count !== 1 || counts.aggregate.submission_count !== 1 || Number(counts.aggregate.selection_rate) !== 100) throw new Error(JSON.stringify(counts))
console.log(JSON.stringify(counts, null, 2))
await db.close()

