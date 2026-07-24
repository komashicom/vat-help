# Country folders — data-review guide

Dear Expert,

Every country gets its own folder (`countries/{CODE}/`) with its
consumption-tax data. You work **only in your own country's folder**, and
open a single GitHub pull request at the end. Below, `{CODE}` refers to
your country's code (e.g. `HU`).

## What can you edit?

| File | Required? | Contains |
|------|-----------|---------------|
| `country.json`   | yes  | rates, threshold, VAT-number pattern, sources, notes (its `_comments` field is a built-in quick guide) |
| `engine.ts`      | optional | {CODE}-specific rule exception for the global engine |
| `review.md`      | NO   | generated — read only |
| `generated.json` | NO   | generated — read only (also marked by the `_comment` field) |

## `country.json` — what to check

| Field | Meaning | What to check |
|------|----------|----------------|
| `std` | standard (normal) rate, % | the value in force |
| `reduced` | reduced rates, % (descending) | the full list; add/remove as needed |
| `reducedCategories` | which `reduced` rate applies to what (`rate` + an `items` example list) | same number of entries, with the same `rate` values, as the `reduced` array; `items` are short, English-language category names (e.g. `"foodstuffs"`, `"books and newspapers"`) |
| `eu` | is it an EU member state | correctness |
| `system` | `vat` / `us` / `ca` / `br` / `au` / `none` | the tax-system type |
| `threshold` | FOREIGN seller's registration threshold | amount + currency, if applicable |
| `vatPattern` | VAT-number format pattern (regex) | correctness of the format (EU only) |
| `subRegions` | state/province combined rates | if `system` is state-based |
| `federal` | federal rate (BR only) | the value in force |
| `rules` | explanatory text for the rules where YOUR country is the one taxing the supply (`ruleKey` → `name` + `detail`) | professional correctness; keep the `{{from}}`/`{{to}}`/`{{loc}}`/`{{buyerRate}}` placeholders in place — the app fills them in with the transaction's country names |

## `engine.ts` — only if needed

The global engine builds a base record for every pair of relations. The
`customize(record, key, countries)` function exported from the local
`engine.ts` runs ONLY for scenarios where the seller = {CODE}. If there's a
{CODE}-specific deviation (e.g. a local exemption, a special threshold), you
can override it here. Default: no-op — leave it unchanged if there's no
deviation.

## Workflow (GitHub pull request)

1. Clone the repo, create a branch: `git checkout -b review-{CODE}`.
2. Edit `country.json` (rates, `meta.sources`, `meta.notes`).
3. If needed, write a {CODE}-specific rule in `engine.ts`.
4. Once you're ready to approve it, set the `meta` block:

   ```json
   "status": "reviewed",
   "reviewedBy": "Dr. Jane Example",
   "reviewedAt": "2026-07-15"
   ```

5. `npm run generate` — regenerates `generated.json`. Review it: is it
   professionally correct from that country's seller perspective?
6. Commit + push + pull request. **The PR should only change files inside
   `countries/{CODE}/`** — don't touch any other file.

## Review sheet

`review.md` is a compact overview of the results computed by the
system — the main transaction types. If any row is wrong, flag it in the PR
description, referencing the `Rule ID`.

*Don't modify anything outside your own `countries/{CODE}/` folder.*
