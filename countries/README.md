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
| `reducedCategories[].type` | the 0% / exempt **invoice codes** your country's sellers must issue | see below |
| `eu` | is it an EU member state | correctness |
| `system` | `vat` / `us` / `ca` / `br` / `au` / `none` | the tax-system type |
| `threshold` | FOREIGN seller's registration threshold | amount + currency, if applicable |
| `vatPattern` | VAT-number format pattern (regex) | correctness of the format (EU only) |
| `subRegions` | state/province combined rates | if `system` is state-based |
| `federal` | federal rate (BR only) | the value in force |
| `rules` | explanatory text for the rules where YOUR country is the one taxing the supply (`ruleKey` → `name` + `detail`) | professional correctness; keep the `{{from}}`/`{{to}}`/`{{loc}}`/`{{buyerRate}}` placeholders in place — the app fills them in with the transaction's country names |

## The `rate: 0` row and its `type` codes

When the calculator returns 0%, the seller's invoice almost always needs a
**code** on the line instead of a percentage. Those codes live in
`reducedCategories`, in the entry whose `rate` is `0`:

```json
"reduced": [18, 5, 0],
"reducedCategories": [
  { "rate": 18, "items": ["basic foodstuffs", "…"], "type": {} },
  { "rate": 5,  "items": ["books and newspapers", "…"], "type": {} },
  { "rate": 0,
    "items": ["daily newspapers (published at least four times a week)",
              "intra-Community supply and export of goods",
              "B2B services taxed in the customer's country",
              "exempt activities (education, healthcare, financial services)"],
    "type": {
      "KBAET":   "Exempt intra-Community supply of goods",
      "EUFAD37": "Reverse charge in another member state — general rule",
      "AAM":     "Exempt small business — subject-based exemption",
      "TAM":     "Exempt activity — public-interest exemption"
    } }
]
```

- **`type` is optional.** Leave it out, or empty, on the ordinary reduced
  rates — a 5% line needs no code, the percentage itself is the value.
- On the **`rate: 0`** entry, `type` is your country's full set of 0% /
  exempt invoice codes: the national codes where your country has its own
  list (HU `EUFAD37`, IT `N3.2`, PL `0 WDT`, TR `302`), otherwise the EN 16931
  categories (`K`, `G`, `AE`, `O`, `E`).
- `type` is a **key-value map**. **The key is what actually goes on the
  invoice** — keep it exactly as the specification spells it, never translate
  it. **The value is a short English explanation** of what the code means, so a
  reader who does not know your country's system can still tell `AAM` (exempt
  small business) from `TAM` (exempt activity). Write the values in English
  even where the official name is not.
- Add `0` to the `reduced` array when you add a `rate: 0` entry.
- If your country mandates no structured code at all (DE, NL, GB, US…), the
  invoice carries a textual legal reference instead — leave `type` empty.

`type` is a **catalogue**: it says which codes exist, not which one belongs to
a given transaction. That mapping goes in `engine.ts` (next section), because
only some codes follow from the relation at all.

## `engine.ts` — only if needed

The global engine builds a base record for every pair of relations. The
`customize(record, key, countries)` function exported from the local
`engine.ts` runs ONLY for scenarios where the seller = {CODE}. If there's a
{CODE}-specific deviation (e.g. a local exemption, a special threshold), you
can override it here. Default: no-op — leave it unchanged if there's no
deviation.

**This is also where the invoice code gets attached to a relation.** See
`countries/HU/engine.ts` for the worked example: a `ruleId → code` map, and a
`customize` that sets `record.invoiceCode` on the 0% records. The rule ids that
can carry a code — all of them 0% on the seller's side — are:

| `ruleId` | Transaction |
|---|---|
| `P-B2B-EU-EU` | intra-Community supply of goods |
| `P-B2B-EU-3` | export of goods to a third country |
| `S-B2B-EU-EU` | B2B service, reverse charge in the customer's member state |
| `S-B2B-EU-3` | B2B service, place of supply outside the EU |
| `S-B2C-DIG-EU-3` | digital service to a non-EU consumer |
| `S-B2B-3-X` | non-EU seller's service export |

**Map only the codes that follow from the relation.** Small-business
exemption (HU `AAM`, DE §19, IT `N2.2`), activity-based exemptions (HU `TAM`,
IT `N4`), domestic reverse charge, margin schemes and out-of-scope items all
depend on the seller's status or on what is being sold — the calculator never
asks, so they must stay in `type` as catalogue entries and never be attached
to a record.

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
