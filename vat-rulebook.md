# VAT rulebook — full listing

This is the **complete** set of rules and limits of the current engine, broken
down into records. This is the specification for the static JSON dataset:
each row is one record (`id` + conditions + treatment + explanation). The app
only **looks up** the matching record, and reads the rate from the country data.

Notation: **P-** = product (goods), **S-** = service. `p` = seller's country, `c` = buyer's country.

---

## 1. Goods (P)

| id | Condition | Place of taxation | Rate | Badge |
|----|----------|-----------------|-------|-------|
| P-DOM | `p == c` (domestic) | seller's country | local rate | Domestic |
| P-B2B-STAY | B2B, cross-border, **the goods do NOT leave** the seller's country | seller's country | seller's local rate (buyer may reclaim it) | Domestic |
| P-B2B-EU-EU | B2B, EU→EU, goods leave the country | buyer's country | **0%** intra-Community supply, reverse charge; buyer at their own standard rate | Reverse charge |
| P-B2B-EU-3 | B2B, EU→non-EU, goods leave the country | destination country (import) | **0%** export; import VAT + customs duty in the destination country (≤ €150: IOSS) | Export · 0% |
| P-B2B-3-EU | B2B, non-EU→EU | destination country (import) | destination country's standard import VAT (+ customs duty) | Import VAT |
| P-B2B-3-3 | B2B, non-EU→non-EU | destination country | destination country's rule (import) | Destination / Import |
| P-B2C-EU-EU-OVER | B2C, EU→EU, **distance selling > €10,000** (seller ships) | buyer's country | destination country's standard rate, OSS | Destination · OSS |
| P-B2C-EU-EU-UNDER | B2C, EU→EU, below threshold | seller's country | seller's standard rate (place of purchase) | Origin rate |
| P-B2C-EU-3 | B2C, EU→non-EU | seller's country | seller's standard rate; consumer may get a tax-free refund with export proof | Origin rate |
| P-B2C-3-EU | B2C, non-EU→EU | destination country (import) | destination country's standard import VAT (≤ €150: IOSS) | Import VAT |
| P-B2C-3-3 | B2C, non-EU→non-EU | seller's country | seller's local rate | Origin (local) |

## 2. Services (S)

| id | Condition | Place of taxation | Rate | Badge |
|----|----------|-----------------|-------|-------|
| S-DOM | `p == c` (domestic) | seller's country | local rate | Domestic |
| S-ONSITE | **Location-bound** (real estate, event admission, restaurant, on-site work), B2B AND B2C | where it takes place (seller OR buyer country — selectable) | the rate of the country where it takes place (**not 0%**), no reverse charge | By location |
| S-B2B-EU-EU | B2B, EU→EU (digital/general) | buyer's country | **0%** reverse charge (Art. 44); buyer at their own standard rate | Reverse charge |
| S-B2B-EU-3 | B2B, EU→non-EU | buyer's country | **0%**, outside EU VAT scope | Outside EU VAT |
| S-B2B-3-X | B2B, **non-EU seller** → anywhere | buyer's country | **0%** service export under the seller's country's rule; if the buyer's country has a consumption tax → reverse charge there (buyer's standard rate); if not (US/HK/QA/KW) → no self-assessment for the buyer | Export · 0% |
| S-B2C-DIG-EU-EU-OVER | B2C **digital**, EU→EU, > €10,000 | buyer's country | destination country's standard rate, OSS (live online events too, from 2025) | Destination · OSS |
| S-B2C-DIG-EU-EU-UNDER | B2C digital, EU→EU, below threshold | seller's country | seller's standard rate | Origin rate |
| S-B2C-DIG-EU-3 | B2C digital, EU→non-EU | destination country | **0%** EU VAT; destination country's digital rules apply (registration may be required there) | Outside EU VAT |
| S-B2C-DIG-3-EU | B2C digital, non-EU→EU | buyer's country | destination country's standard rate, non-Union OSS ("Netflix tax"), **no threshold** | Destination · OSS |
| S-B2C-DIG-3-3 | B2C digital, non-EU→non-EU | buyer's country | destination country's local rate | Destination |
| S-B2C-GEN-EU | B2C **general** (non-digital), EU seller | seller's country | seller's standard rate (Art. 45) | Origin rate |
| S-B2C-GEN-3 | B2C general, non-EU seller | seller's country | seller's local rate | Origin (local) |

## 3. Thresholds and compliance

- **EU distance-selling / OSS threshold: €10,000/year**, cumulative (the OVER/UNDER switch above).
- **Foreign seller's registration threshold** (per country, `threshold` field): e.g. GB GBP 90,000, NO NOK 50,000, CH CHF 100,000, CA CAD 30,000, AU AUD 75,000, NZ NZD 60,000, JP JPY 10,000,000, SG SGD 1,000,000 + 100,000.
- **VIES:** **format** check only (not real-time validity). With an invalid number, the 0% is the seller's risk.
- **No company VAT number → treated as B2C** (no reverse charge).
- Invoice wording: reverse charge ("VAT to be accounted for by the buyer"), export (keep the proof), OSS (a single EU registration).

## 4. Special systems (non-classic VAT)

- **US** — state sales tax: a state must be selected; some states have 0% (OR, DE, MT, NH).
- **CA** — combined provincial (GST + PST/HST).
- **BR** — federal (PIS+COFINS ~9.25%) + state ICMS; **CBS+IBS reform from 2027** (~26–28%).
- **AU** — GST 10%.
- **none** — Hong Kong, Qatar, Kuwait: no general consumption tax → no self-assessment for the buyer.

## 5. Limitations not modeled (good to know)

- The rates are **hardcoded seed data (2026-01)** — may change over time.
- No real (server-side) **VIES** check exists — format only.
- For **on-site** services, only the seller/buyer country can be selected, **not a third country** (e.g. a German company's event in Spain).
- We don't ask which category a **reduced rate** applies to — manual override needed.
- **Not modeled:** triangulation, call-off stock, margin scheme, in-kind exemptions, domestic reverse charge (construction/waste/grain), the details of the Brazil reform, country-specific rules for digital B2C non-EU→non-EU.
- **Not tax advice** — in production, the authority / EU TEDB / a tax engine (Stripe Tax, Avalara, Fonoa) + an accountant are authoritative.

---

### Next step: JSON schema (TypeScript)
Every row above becomes one record in a static array. Planned shape:

```ts
type ScenarioKey = {
  supply: "product" | "service";
  sellerZone: "eu" | "non_eu";
  buyerZone: "eu" | "non_eu";
  domestic: boolean;
  b2b: boolean;
  serviceKind?: "digital" | "general" | "onsite";
  goodsLeave?: boolean;     // goods
  overThreshold?: boolean;  // B2C distance selling
};

type RuleRecord = {
  id: string;                    // e.g. "S-B2B-EU-EU"
  match: ScenarioKey;            // the app looks up records by this
  taxationPlace: "seller" | "buyer" | "onsite_seller" | "onsite_buyer";
  rateSource: "seller_std" | "buyer_std" | "seller_local" | "buyer_local" | "zero";
  reverseCharge: boolean;
  oss: boolean;
  export: boolean;
  badge: string;
  ruleName: string;
  ruleDetail: string;            // template, with {seller}/{buyer} substitution
  notes: string[];
};
```

The app's only job: assemble a `ScenarioKey` from the user's choices, **look
up** the matching `RuleRecord`, and read the rate from `countries.json`
according to `rateSource`. Zero business logic in the component.
