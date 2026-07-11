# コメントゼロスレ 管理ルール

> 背景: 2026-05-02 のコメント物理削除事故を受けた再発防止・運用方針

## 絶対禁止ルール

### 物理削除は禁止

| 禁止操作 | 代替操作 |
|---|---|
| `DELETE FROM posts` | `UPDATE posts SET is_deleted=true` |
| `DELETE FROM threads` | `UPDATE threads SET is_archived=true` |
| `supabase.from('posts').delete()` | `supabase.from('posts').update({is_deleted:true})` |
| `supabase.from('threads').delete()` | `supabase.from('threads').update({is_archived:true})` |

物理削除すると復旧や監査が困難になるため、必ずソフトデリートまたはアーカイブを使用する。

### 大量変更はdry-runを先行する

- 本番DBへの大量INSERT・UPDATEは事前バックアップ、dry-run、プレビュー、ユーザー承認を必須とする
- `post_count` だけで判断せず、`is_deleted=false` の実コメント数も確認する
- PostgRESTの取得上限による見落としに注意する

## コメントゼロスレの扱い

- コメントゼロのスレッドを即時に削除しない
- 固定スレ、管理者保護スレ、`is_protected=true` のスレは対象外とする
- `/admin/revival` は候補確認、保護、アーカイブ操作にのみ使用する
- コメントの自動生成、外部コンテンツの取得・転載、一括コメント投入は行わない

## 管理画面での操作

`/admin/revival` では以下のみを行う。

- コメントゼロスレ候補の確認
- 保護対象の設定・解除
- 不要な候補のアーカイブ

DBを変更する操作は対象を個別確認し、通常の管理画面経路から実行する。

## 定期チェック

- 物理削除コードが追加されていないか確認する
- 保護・アーカイブ状態が意図どおりか確認する
- 本番データを扱う一括操作には、事前バックアップとユーザー承認があることを確認する
