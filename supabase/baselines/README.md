# Supabase production baseline staging

このディレクトリは履歴修復前の検証用であり、Supabase CLIの通常migration適用対象ではない。

- `20260713193000_production_schema_baseline.sql`: 本番 `nodgfukqvuwvgfnlzvnh` の `public` schema catalogから生成したschema-only baseline候補。
- PostgreSQL 17.10一時空DBへの全適用と、本番catalogとの意味的schema diff 0を確認済み。本番へSQL適用せず、履歴repair前にmigration listを再確認する。
- table data、seed、SPRカード、migration履歴操作、PR #551の未適用analytics RPC/indexは含まない。
- 既存 `supabase/migrations` は変更・削除していない。

## 履歴修復の実行候補（未実行）

前提:

1. remoteからfetchした8 migrationとbaselineだけを含むcleanな検証用migrationディレクトリを作る。
2. baselineを空のSupabase検証DBへ適用し、table/column/default/constraint/index/function/view/RLS/policy/trigger/ACLの差分が0であることを確認する。
3. 本番schema-only dump、migration list、baseline checksumを保存する。
4. ユーザーの明示承認を得る。

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713193000
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run --linked
```

rollback候補:

```powershell
npx.cmd supabase migration repair --linked --status reverted 20260713193000
npx.cmd supabase migration list
```

repairはschemaを変更しないが、本番migration履歴を変更する。本ファイル作成時点では未実行。
