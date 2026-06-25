# Zukan bottom spacing fix

This branch adds a nested `/zukan` layout that normalizes bottom spacing for zukan pages.

Target pages:
- `/zukan`
- `/zukan/dm-01`
- `/zukan/dm-01?page=2`
- `/zukan/card/[slug]`

Intent:
- Match the bottom gap before the global footer with the regular TOP page spacing.
- Avoid changing database, auth, storage, reviews, ratings, or existing data.
