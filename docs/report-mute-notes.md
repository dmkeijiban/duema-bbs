# 通報受付停止メモ

このPRでは、通報をDBへ保存し、`report_mutes` に一致する送信元からの通報を受け付けない仕組みを追加します。

## 追加テーブル

- `reports`
- `report_mutes`

## 管理画面

- `/admin/reports`
- `/admin/report-mutes`

## 注意

SQL実行後に利用してください。
