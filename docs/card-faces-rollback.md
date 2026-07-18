# Card faces rollback and disable procedure

`card_faces` and `face_import_runs` are additive. Existing `cards` and `card_printings` rows are not updated by the migration or importer.

## Preferred rollback

1. Roll back the application deployment to the previous Production deployment.
2. Leave both additive tables in place so imported audit data remains recoverable.
3. Confirm the old search route ignores `card_faces` and the deck maker still uses `cards.id`.

This is the default rollback because dropping tables would destroy collected data and is unnecessary for restoring the previous application behavior.

## Database removal

Only after a separate explicit approval and backup, remove dependent indexes and the two additive tables. Do not modify or delete rows from `cards` or `card_printings`. Production removal is not part of the normal rollback.
