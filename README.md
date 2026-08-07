# Global VAT Help — TypeScript, pre-built dataset

A mobile-first, step-by-step (onboarding-style) VAT calculator.
**The app doesn't calculate anything itself** — the rule engine runs at
**build time** and pre-builds every relation into a static JSON dataset. At
runtime the app only **looks up** the finished record.

## Architecture (fixed structure)

```
countries/               ← PER-COUNTRY HANDOFF FOLDERS (edited by the tax expert)
  README.md              ← SHARED guide for the experts (one file, not per country)
  HU/country.json        ← rates, threshold, VAT-number pattern, meta
  HU/engine.ts           ← optional HU-specific rule exception (customize)
  HU/generated.json      ← GENERATED: HU-as-seller records (`_comment` at the top)
  HU/review.md           ← GENERATED: readable table for the expert

scripts/                 ← BUILD-TIME ONLY (never ships in the app)
  engine.ts              ← the global rule engine (maps out vat-rulebook.md)
  generate.ts            ← builds every relation → results.json + per-country generated.json
  merge-countries.ts     ← countries/*/country.json → src/data/countries.json
  report.ts              ← generates countries/*/review.md

src/
  schema/                ← TypeScript SCHEMA (types only)
    country.ts           ← Country, SubRegion, ReducedRateInfo, TaxSystem, CountryDataset
    result.ts            ← ScenarioKey, ResultRecord, Badge, ComplianceNote
  data/                  ← STATIC DATA (the app only reads it)
    countries.json       ← countries + rates + sub-regions + thresholds + vatPattern
    countries.ts         ← typed access (COUNTRIES, byCode…)
  public/data/results.json ← GENERATED: ALL pre-built final results (one file)
  lib/
    vat.ts               ← ★ CENTRAL HELPER: lookup + calculate + validation.
                           Framework-independent; the UI and the Komashi
                           integration both call this EXCLUSIVELY.
  search/
    key.ts               ← normalizeKey + keyOf (called by both the generator AND the lib)
    lookup.ts            ← thin re-export from the lib (compatibility)
    validate.ts          ← thin re-export from the lib (compatibility)
  ui/                    ← components (mobile-first, display only)
  onboarding/Wizard.tsx  ← the step-by-step flow
  App.tsx
```

### The search-key convention

Every record's `key` field is a fixed-order, `|`-separated string — the
record's unique identifier:

```
HU|DE|service|b2b|digital|na|na|na
 1   2    3     4     5    6  7  8
```

| # | Field | Values | When relevant |
|---|------|---------|----------------|
| 1 | Seller's country | country code (`HU`, `DE`…) | always |
| 2 | Buyer's country | country code | always |
| 3 | What's being sold | `product` / `service` | always |
| 4 | Buyer type | `b2b` / `b2c` | always |
| 5 | Kind of service | `digital` / `general` / `onsite` | services only |
| 6 | Goods leave the country | `leave` / `stay` | cross-border B2B goods only |
| 7 | €10,000 EU threshold | `over` / `under` | EU→EU B2C distance selling only (goods / digital) |
| 8 | Location | `seller` / `customer` | on-site services only |

**`na`** = *not applicable*: the field isn't meaningful in that case. Set by
`normalizeKey` (src/search/key.ts) — e.g. for goods, field 5 is always `na`;
for a domestic deal, fields 6–8 are all `na`.

This guarantees two things:

1. **One real-world scenario = one record.** Without zeroing out the
   irrelevant dimensions, the same outcome would be split across several
   duplicate records (e.g. a domestic B2C goods sale in "digital" and
   "general" variants). That's why the record count is 59,908, not several
   hundred thousand.
2. **The generator and the app are guaranteed to build the exact same key**,
   because both call the same two functions (`normalizeKey` + `keyOf`). The
   app assembles the string from the user's answers and finds the record
   with a single `Map.get(key)`.

⚠️ The field order is a fixed convention. If you ever extend it (a new
dimension), three places need to change together: `ScenarioKey` (schema),
`normalizeKey` + `keyOf` (key.ts), and the engine branch — then `npm run
generate` rebuilds the data.

### Why is there no logic in the app?

`key.ts` is the single source of truth: the **generator** and the **app**
build the search key with the exact same function, so they're guaranteed to
match. The app only does: `answers → normalizeKey → keyOf → index.get(key)`
→ finished record. The numbers come from `lib/vat.ts`'s `calculate()` — it
multiplies by the finished record's rate, it doesn't evaluate any tax rule.

### Data size

59,908 records in a single `results.json` (~45 MB raw, **~1.1 MB gzip** — the
server serves it with gzip/brotli compression). After the first load, an
in-memory key→record index serves lookups (O(1)).

## Integration (Komashi) — `src/lib/vat.ts`

Every runtime function lives in ONE place, framework-independent (no React):
the UI calls this exclusively too, so when it's lifted into another project
you're guaranteed to get the same behavior.

```ts
import { lookup, calculate, lookupAndCalculate, checkVatId, setResultsUrl } from "./lib/vat";

setResultsUrl("/assets/vat/results.json");   // optional, default: /data/results.json

const hit = await lookupAndCalculate(
  { from: "HU", to: "DE", supply: "service", b2b: true,
    serviceKind: "digital", goodsLeave: "na", overThreshold: "na", onsiteLocation: "na" },
  1000,          // net amount
);
// hit.record  → the full JSON record (badge, ruleId, explanation, notes…)
// hit.calc    → { rate: 0, vat: 0, gross: 1000, buyerRate: 19, buyerVat: 190, … }

checkVatId("DE", "DE123456789");  // format check against the patterns in countries.json
```

API: `lookup(key)`, `calculate(record, net, stateCode?)`, `lookupAndCalculate(...)`,
`resolveRate`, `checkVatId`/`cleanVatId`, `setResultsUrl`/`setResultsData` (SSR/test),
`recordsFrom(seller)`, `queryRecords(predicate)`, `listCountries()`.
`calculate` is deterministic: it multiplies by the finished record's rate, it
doesn't evaluate any tax rule.

## Running it

```bash
npm install
npm run dev       # regenerates the data first (predev), then the Vite dev server
npm run build     # typecheck + generate + production build
npm run generate  # regenerate the data only (after a rate/rule change)
npm run typecheck
```

> `public/data/results.json` is **generated** — `predev`/`prebuild` always
> rebuild it from `countries.json`. It doesn't need to be checked into version control.

## Per-country expert handoff — `countries/`

Every country has its own handoff folder, and the tax expert works
**only in their own folder** on GitHub, opening a single pull request:

```
countries/README.md ← SHARED guide for the experts (what, how, approval)
countries/HU/
  country.json    ← the expert edits THIS (rates, threshold, pattern)
                     + meta: sources[], notes, status/reviewedBy/reviewedAt
  engine.ts       ← optional: HU-specific rule exception (customize())
  review.md       ← GENERATED: the engine's results from their country's point of view
  generated.json  ← GENERATED: all HU-as-seller records (first field is
                     `_comment: "AUTOMATICALLY GENERATED — do not edit"`)
```

Workflow (from the expert's side):

1. Fork/clone + new branch: `git checkout -b review-HU`.
2. Edit `country.json` (rates, `meta.sources`, `meta.notes`).
3. If there's an HU-specific deviation from the global rule: `engine.ts` →
   `customize()` — can return a modified record for the scenarios where the
   seller = HU.
4. `npm run generate` — the system builds `generated.json` and
   `review.md`. Review them.
5. If it looks right: `meta.status = "reviewed"` + name + date → commit + push + PR.
   **The PR should only touch the `countries/HU/` folder.**

The per-country `engine.ts`'s `customize(record, key, countries)` function
runs ONLY on that country's own seller-side records (AFTER the global
engine). No-op by default — only change it if there's a genuine local
deviation.

Commands: `npm run merge` (folders → countries.json; part of `generate`),
`npm run reports` (regenerate the review sheets).

Global rule changes (affect every country): `scripts/engine.ts`.
This does NOT belong to the expert's folder — it's edited by the project maintainers.

## Maintenance
- **Changing a rate/country:** `src/data/countries.json` → `npm run generate`.
- **Changing a rule:** `scripts/engine.ts` (the rule IDs match `vat-rulebook.md`) → `npm run generate`.
- **New rule:** engine + rulebook + (if needed) a new dimension in `ScenarioKey` and `normalizeKey`.

## Limitations
See `vat-rulebook.md`. In short: hardcoded seed rates (2026-01), VIES
format-only, on-site services only support seller/buyer country, no
category-based reduced-rate selection in the calculation itself — the
example categories for each reduced rate (`reducedCategories` in
`country.json`) are shown for reference only, in the country picker's
tooltip; the calculator still uses the finished record's rate (a plain
std/reduced number) for the actual calculation.
**Decision-support prototype — not tax advice.**
